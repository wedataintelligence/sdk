/**
 * @file mega/posix/meganet.h
 * @brief POSIX network access layer (using cURL + c-ares)
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

#ifndef HTTPIO_CLASS
#define HTTPIO_CLASS JSHttpIO

#include "mega.h"

namespace mega {

class JSHttpIO: public HttpIO
{
public:
    void onloadend(void*, int, void*, int);
    void post(HttpReq*, const char* = 0, unsigned = 0);
    void cancel(HttpReq*);
    void sendchunked(HttpReq*);

    m_off_t postpos(void*);

    bool doio(void);

    void addevents(Waiter*, int);

    void setuseragent(string*);
    void setproxy(Proxy*);
    Proxy* getautoproxy();
    void setdnsservers(const char*);
    void disconnect();

    JSHttpIO();
    ~JSHttpIO();
    
    WAIT_CLASS* waiter;
};

struct MEGA_API JSHttpContext
{
    HttpReq* req;
    JSHttpIO* httpio;

    int ctxid;
    unsigned postpos;
    unsigned postlen;
    const char* postdata;
};

} // namespace

#endif
