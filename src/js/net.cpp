/**
 * @file emsdk/net.cpp
 * @brief JavaScript network access layer
 *
 * (c) 2016 by Mega Limited, Auckland, New Zealand
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

#include "mega.h"

extern "C" {
    extern void jsnet_init();
    extern void jsnet_setuseragent(const char*);
    extern int jsnet_post(const char*, const char*);
    extern void jsnet_cancel(int);

    mega::JSHttpContext __httpctx[9999]; // fixme
    extern void jsnet_onloadend(int ctx, int status, const char* data, int datalen)
    {
        mega::JSHttpContext* httpctx = (mega::JSHttpContext*) &__httpctx[ctx];
        mega::JSHttpIO* httpio = (mega::JSHttpIO*)httpctx->httpio;

        httpio->onloadend(httpctx, status, data, datalen);
    }
    extern void jsnet_progress(int ctx, int loaded)
    {
        mega::JSHttpContext* httpctx = (mega::JSHttpContext*) &__httpctx[ctx];
        mega::JSHttpIO* httpio = (mega::JSHttpIO*)httpctx->httpio;

        httpctx->postpos = loaded;

        if (httpio->waiter)
        {
            httpio->waiter->notify();
        }
    }
}

namespace mega {

JSHttpIO::JSHttpIO()
{
    waiter = NULL;
    chunkedok = false;
    jsnet_init();
}

JSHttpIO::~JSHttpIO()
{
}

void JSHttpIO::setuseragent(string* useragent)
{
    jsnet_setuseragent(useragent->c_str());
}

void JSHttpIO::disconnect()
{

}

void JSHttpIO::setdnsservers(const char*)
{
    LOG_info << "SETDNSSERVERS";
}

void JSHttpIO::setproxy(Proxy* proxy)
{
    LOG_info << "Proxy disabled";
}

Proxy* JSHttpIO::getautoproxy()
{
    Proxy* proxy = new Proxy();
    proxy->setProxyType(Proxy::NONE);
    return proxy;
}

// ensure wakeup from JSHttpIO events
void JSHttpIO::addevents(Waiter* cwaiter, int flags)
{
    waiter = (WAIT_CLASS*)cwaiter;
}

// XHR onloadend handler
void JSHttpIO::onloadend(void* handle, int status, const char *data, int datalen)
{
    JSHttpContext* httpctx = (JSHttpContext*) handle;
    JSHttpIO* httpio = (JSHttpIO*)httpctx->httpio;
    HttpReq* req = httpctx->req;

    if (!req)
    {
        LOG_verbose << "Request cancelled";
        return;
    }

    req->httpstatus = status;

    LOG_debug << "Request finished with HTTP status: " << req->httpstatus;
    req->status = (req->httpstatus == 200) ? REQ_SUCCESS : REQ_FAILURE;

    if (req->status == REQ_SUCCESS)
    {
        httpio->lastdata = Waiter::ds;

        if (datalen) {
            if (req->buf) {
                memcpy(req->buf, data, datalen);
            }
            else {
                req->in.assign(data, datalen);
            }
        }
    }

    if (req->binary)
    {
        LOG_debug << "[received " << (req->buf ? req->buflen : req->in.size()) << " bytes of raw data]";
    }
    else
    {
        if(req->in.size() < 2048)
        {
            LOG_debug << "Received: " << req->in.c_str();
        }
        else
        {
            LOG_debug << "Received: " << req->in.substr(0,2048).c_str();
        }
    }

    httpio->success = true;

    if (waiter)
    {
        waiter->notify();
    }
}

// POST request to URL
void JSHttpIO::post(HttpReq* req, const char* data, unsigned len)
{
    int ctx;

    LOG_debug << "POST target URL: " << req->posturl << " chunked: " << req->chunked;

    if (req->binary)
    {
        LOG_debug << "[sending " << (data ? len : req->out->size()) << " bytes of raw data]";
    }
    else
    {
        LOG_debug << "Sending: " << *req->out;
    }

    ctx = jsnet_post(req->posturl.c_str(), data ? data : req->out->data());
    if (ctx < 0)
    {
        LOG_err << "Request failed";
        req->status = REQ_FAILURE;
    }
    else
    {
        JSHttpContext* httpctx;

        httpctx = new JSHttpContext;

        httpctx->httpio = this;
        httpctx->req = req;
        httpctx->ctxid = ctx;
        __httpctx[ctx] = *httpctx;

        req->httpiohandle = (void*)httpctx;

        req->in.clear();
        req->status = REQ_INFLIGHT;
    }

    if (waiter)
    {
        waiter->notify();
    }
}

// unfortunately, WinHTTP does not allow alternating reads/writes :(
void JSHttpIO::sendchunked(HttpReq*)
{
}

// cancel pending HTTP request
void JSHttpIO::cancel(HttpReq* req)
{
    JSHttpContext* httpctx;

    if ((httpctx = (JSHttpContext*)req->httpiohandle))
    {
        httpctx->req = NULL;

        req->httpstatus = 0;
        req->status = REQ_FAILURE;
        req->httpiohandle = NULL;

        jsnet_cancel(httpctx->ctxid);
        delete httpctx;

        if (waiter)
        {
            waiter->notify();
        }
    }
}

// supply progress information on POST data
m_off_t JSHttpIO::postpos(void* handle)
{
    return ((JSHttpContext*)handle)->postpos;
}

// process events
bool JSHttpIO::doio()
{
    return false;
}
} // namespace
