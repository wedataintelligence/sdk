/**
 * @file transferslot.cpp
 * @brief Class for active transfer
 *
 * (c) 2013-2014 by Mega Limited, Auckland, New Zealand
 *
 * This file is part of the MEGA SDK - Client Access Engine.
 *
 * Applications using the MEGA API must present a valid application key
 * and comply with the the rules set forth in the Terms of Service.
 *
 * The MEGA SDK is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 *
 * @copyright Simplified (2-clause) BSD License.
 *
 * You should have received a copy of the license along with this
 * program.
 */

#include "mega/transferslot.h"
#include "mega/node.h"
#include "mega/transfer.h"
#include "mega/megaclient.h"
#include "mega/command.h"
#include "mega/base64.h"
#include "mega/megaapp.h"
#include "mega/utils.h"
#include "mega/logging.h"

namespace mega {
TransferSlot::TransferSlot(Transfer* ctransfer)
{
    starttime = 0;
    progressreported = 0;
    progresscompleted = 0;
    lastdata = Waiter::ds;
    errorcount = 0;

    failure = false;
    retrying = false;
    
    fileattrsmutable = 0;

    reqs = NULL;
    pendingcmd = NULL;

    transfer = ctransfer;
    transfer->slot = this;

    connections = transfer->size > 131072 ? transfer->client->connections[transfer->type] : 1;

    reqs = new HttpReqXfer*[connections]();
    asyncIO = new AsyncIOContext*[connections]();

    fa = transfer->client->fsaccess->newfileaccess();

    slots_it = transfer->client->tslots.end();
}

// delete slot and associated resources, but keep transfer intact (can be
// reused on a new slot)
TransferSlot::~TransferSlot()
{
    transfer->slot = NULL;

    if (slots_it != transfer->client->tslots.end())
    {
        // advance main loop iterator if deleting next in line
        if (transfer->client->slotit != transfer->client->tslots.end() && *transfer->client->slotit == this)
        {
            transfer->client->slotit++;
        }

        transfer->client->tslots.erase(slots_it);
    }

    if (pendingcmd)
    {
        pendingcmd->cancel();
    }

    if (fa)
    {
        delete fa;

        if ((transfer->type == GET) && transfer->localfilename.size())
        {
            transfer->client->fsaccess->unlinklocal(&transfer->localfilename);
        }
    }

    while (connections--)
    {
        delete asyncIO[connections];
        delete reqs[connections];
    }

    delete[] asyncIO;
    delete[] reqs;
}

void TransferSlot::toggleport(HttpReqXfer *req)
{
    if (!memcmp(req->posturl.c_str(), "http:", 5))
    {
       size_t portendindex = req->posturl.find("/", 8);
       size_t portstartindex = req->posturl.find(":", 8);

       if (portendindex != string::npos)
       {
           if (portstartindex == string::npos)
           {
               LOG_debug << "Enabling alternative port for chunk";
               req->posturl.insert(portendindex, ":8080");
           }
           else
           {
               LOG_debug << "Disabling alternative port for chunk";
               req->posturl.erase(portstartindex, portendindex - portstartindex);
           }
       }
    }
}

// abort all HTTP connections
void TransferSlot::disconnect()
{
    for (int i = connections; i--;)
    {
        if (reqs[i])
        {
            reqs[i]->disconnect();
        }
    }
}

// coalesce block macs into file mac
int64_t TransferSlot::macsmac(chunkmac_map* macs)
{
    byte mac[SymmCipher::BLOCKSIZE] = { 0 };

    for (chunkmac_map::iterator it = macs->begin(); it != macs->end(); it++)
    {
        SymmCipher::xorblock(it->second.mac, mac);
        transfer->key.ecb_encrypt(mac);
    }

    macs->clear();

    uint32_t* m = (uint32_t*)mac;

    m[0] ^= m[1];
    m[1] = m[2] ^ m[3];

    return MemAccess::get<int64_t>((const char*)mac);
}

// file transfer state machine
void TransferSlot::doio(MegaClient* client)
{
    if (!fa)
    {
        // this is a pending completion, retry every 200 ms by default
        retrybt.backoff(2);
        retrying = true;

        return transfer->complete();
    }

    retrying = false;

    if (!tempurl.size())
    {
        return;
    }

    time_t backoff = 0;
    m_off_t p = 0;

    if (errorcount > 4)
    {
        LOG_warn << "Failed transfer: too many errors";
        return transfer->failed(API_EFAILED);
    }

    for (int i = connections; i--; )
    {
        if (reqs[i])
        {
            switch (reqs[i]->status)
            {
                case REQ_INFLIGHT:
                    p += reqs[i]->transferred(client);
                    break;

                case REQ_SUCCESS:
                    if (client->orderdownloadedchunks && transfer->type == GET && progresscompleted != ((HttpReqDL *)reqs[i])->dlpos)
                    {
                        // postponing unsorted chunk
                        p += reqs[i]->size;
                        break;
                    }

                    lastdata = Waiter::ds;

                    progresscompleted += reqs[i]->size;

                    if (transfer->type == PUT)
                    {
                        errorcount = 0;

                        // completed put transfers are signalled through the
                        // return of the upload token
                        if (reqs[i]->in.size())
                        {
                            if (reqs[i]->in.size() == NewNode::UPLOADTOKENLEN * 4 / 3)
                            {
                                if (Base64::atob(reqs[i]->in.data(), transfer->ultoken, NewNode::UPLOADTOKENLEN + 1)
                                    == NewNode::UPLOADTOKENLEN)
                                {
                                    memcpy(transfer->filekey, transfer->key.key, sizeof transfer->key.key);
                                    ((int64_t*)transfer->filekey)[2] = transfer->ctriv;
                                    ((int64_t*)transfer->filekey)[3] = macsmac(&transfer->chunkmacs);
                                    SymmCipher::xorblock(transfer->filekey + SymmCipher::KEYLENGTH, transfer->filekey);

                                    return transfer->complete();
                                }
                            }

                            progresscompleted -= reqs[i]->size;

                            // fail with returned error
                            return transfer->failed((error)atoi(reqs[i]->in.c_str()));
                        }
                        reqs[i]->status = REQ_READY;
                    }
                    else
                    {
                        if (reqs[i]->size == reqs[i]->bufpos)
                        {
                            errorcount = 0;

                            if (fa->asyncavailable())
                            {
                                if (!asyncIO[i])
                                {
                                    reqs[i]->finalize(&transfer->key, &transfer->chunkmacs, transfer->ctriv);
                                }
                                else
                                {
                                    LOG_warn << "Retrying failed async write";
                                    delete asyncIO[i];
                                    asyncIO[i] = NULL;
                                }

                                progresscompleted -= reqs[i]->size;
                                p += reqs[i]->size;

                                LOG_debug << "Writting data asynchronously at " << ((HttpReqDL *)reqs[i])->dlpos;
                                asyncIO[i] = fa->asyncfwrite(reqs[i]->buf, reqs[i]->bufpos, ((HttpReqDL *)reqs[i])->dlpos);
                                reqs[i]->status = REQ_ASYNCIO;
                            }
                            else
                            {
                                reqs[i]->finalize(&transfer->key, &transfer->chunkmacs, transfer->ctriv);
                                fa->fwrite(reqs[i]->buf, reqs[i]->bufpos, ((HttpReqDL *)reqs[i])->dlpos);
                                if (progresscompleted == transfer->size)
                                {
                                    // verify meta MAC
                                    if (!progresscompleted || (macsmac(&transfer->chunkmacs) == transfer->metamac))
                                    {
                                        return transfer->complete();
                                    }
                                    else
                                    {
                                        progresscompleted -= reqs[i]->size;
                                        return transfer->failed(API_EKEY);
                                    }
                                }
                                reqs[i]->status = REQ_READY;
                            }
                        }
                        else
                        {
                            progresscompleted -= reqs[i]->size;
                            errorcount++;
                            reqs[i]->status = REQ_PREPARED;
                            break;
                        }
                    }

                    break;

                case REQ_ASYNCIO:
                    if (asyncIO[i]->finished)
                    {
                        LOG_verbose << "Processing finished async fs operation";
                        if (!asyncIO[i]->failed)
                        {
                            if (transfer->type == PUT)
                            {
                                LOG_verbose << "Async read succeeded";
                                m_off_t npos = ChunkedHash::chunkceil(asyncIO[i]->pos);

                                if (npos > transfer->size)
                                {
                                    npos = transfer->size;
                                }

                                string finaltempurl = tempurl;
                                if (transfer->type == GET && client->usealtdownport
                                        && !memcmp(tempurl.c_str(), "http:", 5))
                                {
                                    size_t index = tempurl.find("/", 8);
                                    if(index != string::npos && tempurl.find(":", 8) == string::npos)
                                    {
                                        finaltempurl.insert(index, ":8080");
                                    }
                                }

                                if (transfer->type == PUT && client->usealtupport
                                        && !memcmp(tempurl.c_str(), "http:", 5))
                                {
                                    size_t index = tempurl.find("/", 8);
                                    if(index != string::npos && tempurl.find(":", 8) == string::npos)
                                    {
                                        finaltempurl.insert(index, ":8080");
                                    }
                                }

                                reqs[i]->prepare(finaltempurl.c_str(), &transfer->key,
                                         &transfer->chunkmacs, transfer->ctriv,
                                         asyncIO[i]->pos, npos);

                                reqs[i]->status = REQ_PREPARED;
                            }
                            else
                            {
                                LOG_verbose << "Async write succeeded";
                                progresscompleted += reqs[i]->size;
                                if (progresscompleted == transfer->size)
                                {
                                    // verify meta MAC
                                    if (!progresscompleted || (macsmac(&transfer->chunkmacs) == transfer->metamac))
                                    {
                                        return transfer->complete();
                                    }
                                    else
                                    {
                                        progresscompleted -= reqs[i]->size;
                                        return transfer->failed(API_EKEY);
                                    }
                                }
                                reqs[i]->status = REQ_READY;
                                if (client->orderdownloadedchunks)
                                {
                                    // Check connections again looking for postponed chunks
                                    delete asyncIO[i];
                                    asyncIO[i] = NULL;
                                    i = connections;
                                    continue;
                                }
                            }
                            delete asyncIO[i];
                            asyncIO[i] = NULL;
                        }
                        else
                        {
                            LOG_warn << "Async operation failed: " << asyncIO[i]->retry;
                            if (!asyncIO[i]->retry)
                            {
                                delete asyncIO[i];
                                asyncIO[i] = NULL;
                                return transfer->failed(transfer->type == PUT ? API_EREAD : API_EWRITE);
                            }

                            // retry shortly
                            reqs[i]->status = transfer->type == PUT ? REQ_READY : REQ_SUCCESS;
                            backoff = 2;
                        }
                    }
                    else
                    {
                        p += asyncIO[i]->len;
                    }
                    break;

                case REQ_FAILURE:
                    LOG_warn << "Chunk failed";
                    if (reqs[i]->httpstatus == 509)
                    {
                        client->app->transfer_limit(transfer);

                        // fixed ten-minute retry intervals
                        backoff = 6000;
                        retrying = true;
                    }
                    else
                    {
                        if (!failure)
                        {
                            failure = true;
                            bool changeport = false;

                            if (transfer->type == GET && client->autodownport && !memcmp(tempurl.c_str(), "http:", 5))
                            {
                                LOG_debug << "Automatically changing download port";
                                client->usealtdownport = !client->usealtdownport;
                                changeport = true;
                            }
                            else if (transfer->type == PUT && client->autoupport && !memcmp(tempurl.c_str(), "http:", 5))
                            {
                                LOG_debug << "Automatically changing upload port";
                                client->usealtupport = !client->usealtupport;
                                changeport = true;
                            }

                            client->app->transfer_failed(transfer, API_EFAILED);
                            client->setchunkfailed(&reqs[i]->posturl);

                            if (changeport)
                            {
                                toggleport(reqs[i]);
                            }
                        }
                    }
                    reqs[i]->status = REQ_PREPARED;

                default:
                    ;
            }
        }

        if (!failure)
        {
            if (!reqs[i] || (reqs[i]->status == REQ_READY))
            {
                m_off_t npos = ChunkedHash::chunkceil(transfer->pos);

                if (npos > transfer->size)
                {
                    npos = transfer->size;
                }

                if ((npos > transfer->pos) || !transfer->size || (transfer->type == PUT && asyncIO[i]))
                {
                    if (!reqs[i])
                    {
                        reqs[i] = transfer->type == PUT ? (HttpReqXfer*)new HttpReqUL() : (HttpReqXfer*)new HttpReqDL();
                    }

                    bool prepare = true;
                    if (transfer->type == PUT)
                    {
                        unsigned pos = transfer->pos;
                        unsigned size = (unsigned)(npos - pos);

                        if (fa->asyncavailable())
                        {
                            if (asyncIO[i])
                            {
                                LOG_warn << "Retrying a failed read";
                                pos = asyncIO[i]->pos;
                                size = asyncIO[i]->len;
                                npos = ChunkedHash::chunkceil(pos);
                                delete asyncIO[i];
                                asyncIO[i] = NULL;
                            }

                            asyncIO[i] = fa->asyncfread(reqs[i]->out, size, (-(int)size) & (SymmCipher::BLOCKSIZE - 1), pos);
                            reqs[i]->status = REQ_ASYNCIO;
                            prepare = false;
                        }
                        else
                        {
                            if (!fa->fread(reqs[i]->out, size, (-(int)size) & (SymmCipher::BLOCKSIZE - 1), transfer->pos))
                            {
                                LOG_warn << "Error preparing transfer: " << fa->retry;
                                if (!fa->retry)
                                {
                                    return transfer->failed(API_EREAD);
                                }

                                // retry the read shortly
                                backoff = 2;
                                npos = transfer->pos;
                                prepare = false;
                            }
                        }
                    }

                    if (prepare)
                    {
                        string finaltempurl = tempurl;
                        if (transfer->type == GET && client->usealtdownport
                                && !memcmp(tempurl.c_str(), "http:", 5))
                        {
                            size_t index = tempurl.find("/", 8);
                            if(index != string::npos && tempurl.find(":", 8) == string::npos)
                            {
                                finaltempurl.insert(index, ":8080");
                            }
                        }

                        if (transfer->type == PUT && client->usealtupport
                                && !memcmp(tempurl.c_str(), "http:", 5))
                        {
                            size_t index = tempurl.find("/", 8);
                            if(index != string::npos && tempurl.find(":", 8) == string::npos)
                            {
                                finaltempurl.insert(index, ":8080");
                            }
                        }

                        reqs[i]->prepare(finaltempurl.c_str(), &transfer->key,
                                                                 &transfer->chunkmacs, transfer->ctriv,
                                                                 transfer->pos, npos);
                        reqs[i]->status = REQ_PREPARED;
                    }

                    if (transfer->pos < npos)
                    {
                        transfer->pos = npos;
                    }
                }
                else if (reqs[i])
                {
                    reqs[i]->status = REQ_DONE;
                }
            }

            if (reqs[i] && (reqs[i]->status == REQ_PREPARED))
            {
                reqs[i]->post(client);
            }
        }
    }

    p += progresscompleted;

    if (p != progressreported)
    {
        progressreported = p;
        lastdata = Waiter::ds;

        progress();
    }

    if (Waiter::ds - lastdata >= XFERTIMEOUT && !failure)
    {
        failure = true;
        bool changeport = false;

        if (transfer->type == GET && client->autodownport && !memcmp(tempurl.c_str(), "http:", 5))
        {
            LOG_debug << "Automatically changing download port due to a timeout";
            client->usealtdownport = !client->usealtdownport;
            changeport = true;
        }
        else if (transfer->type == PUT && client->autoupport && !memcmp(tempurl.c_str(), "http:", 5))
        {
            LOG_debug << "Automatically changing upload port due to a timeout";
            client->usealtupport = !client->usealtupport;
            changeport = true;
        }

        client->app->transfer_failed(transfer, API_EFAILED);

        for (int i = connections; i--; )
        {
            if (reqs[i] && reqs[i]->status == REQ_INFLIGHT)
            {
                client->setchunkfailed(&reqs[i]->posturl);
                reqs[i]->disconnect();

                if (changeport)
                {
                    toggleport(reqs[i]);
                }

                reqs[i]->status = REQ_PREPARED;
            }
        }
    }

    if (!failure)
    {
        if (!backoff && (Waiter::ds - lastdata) < XFERTIMEOUT)
        {
            // no other backoff: check again at XFERMAXFAIL
            backoff = XFERTIMEOUT - (Waiter::ds - lastdata);
        }

        retrybt.backoff(backoff);
    }
}

// transfer progress notification to app and related files
void TransferSlot::progress()
{
    transfer->client->app->transfer_update(transfer);

    for (file_list::iterator it = transfer->files.begin(); it != transfer->files.end(); it++)
    {
        (*it)->progress();
    }
}
} // namespace
