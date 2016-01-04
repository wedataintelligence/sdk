/**
 * @file posix/fs.cpp
 * @brief POSIX filesystem/directory access/notification
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
 * MacOS X fsevents code based on osxbook.com/software/fslogger
 * (requires euid == root or passing an existing /dev/fsevents fd)
 * (c) Amit Singh
 *
 * You should have received a copy of the license along with this
 * program.
 */

#include "mega.h"
#include <sys/utsname.h>
#include <sys/ioctl.h>
#include <emscripten.h>

extern "C" {
    extern void EMSCRIPTEN_KEEPALIVE onAsyncFinished(void* ctx, int failed, int retry, int finished, void *data)
    {
        mega::PosixAsyncIOContext* context = (mega::PosixAsyncIOContext*) ctx;

        context->retry = retry;
        context->failed = failed;
        context->finished = finished;
        if (finished && data)
        {
            memcpy(context->buffer, data, context->len);
        }
        if (context->userCallback)
        {
            context->userCallback(context->userData);
        }
    }
}

namespace mega {

PosixAsyncIOContext::PosixAsyncIOContext() : AsyncIOContext()
{
    synchronizer = NULL;
}

PosixAsyncIOContext::~PosixAsyncIOContext()
{
    LOG_verbose << "Deleting PosixAsyncIOContext";
    pthread_mutex_lock(&PosixFileAccess::asyncmutex);
    if (synchronizer)
    {
        synchronizer->context = NULL;
        synchronizer = NULL;
    }
    pthread_mutex_unlock(&PosixFileAccess::asyncmutex);
}

PosixFileAccess::PosixFileAccess(Waiter *w) : FileAccess(w)
{
    LOG_info << "PosixFileAccess::PosixFileAccess";
    fd = -1;

#ifndef HAVE_FDOPENDIR
    dp = NULL;
#endif

    fsidvalid = false;
}

PosixFileAccess::~PosixFileAccess()
{
    LOG_info << "PosixFileAccess::~PosixFileAccess";
#ifndef HAVE_FDOPENDIR
    if (dp)
    {
        closedir(dp);
    }
#endif
#ifndef EMSCRIPTEN
    if (fd >= 0)
    {
        close(fd);
    }
#endif
}

bool PosixFileAccess::sysstat(m_time_t* mtime, m_off_t* size)
{
    int isvalid;
    const char *filename = localname.c_str();

    LOG_info << "PosixFileAccess::sysstat --> " << filename;

    retry = false;

    isvalid = EM_ASM_INT({
        var v = StringView($0);
        return !!FileAccess._stat(v, 1);
    }, filename);

    if (isvalid)
    {
        *size = EM_ASM_INT({
            var v = StringView($0);
            return FileAccess._stat(v).size | 0;
        }, filename);

        *mtime = EM_ASM_INT({
            var v = StringView($0);
            var r = FileAccess._stat(v).mtime | 0;
            v.free();
            return r;
        }, filename);

        FileSystemAccess::captimestamp(mtime);

        return true;
    }

    return false;
}

bool PosixFileAccess::sysopen()
{
    LOG_warn << "sysopen";
    return false;
}

void PosixFileAccess::sysclose()
{
    LOG_warn << "sysclose";
#ifndef EMSCRIPTEN
    if (localname.size())
    {
        // fd will always be valid at this point
        close(fd);
        fd = -1;
    }
#endif
}

pthread_mutex_t PosixFileAccess::asyncmutex = PTHREAD_MUTEX_INITIALIZER;

bool PosixFileAccess::asyncavailable()
{
    return true;
}

AsyncIOContext *PosixFileAccess::newasynccontext()
{
    return new PosixAsyncIOContext();
}

void PosixFileAccess::asyncopfinished(union sigval sigev_value)
{
    LOG_warn << "PosixFileAccess::asyncopfinished";
    PosixAsyncSynchronizer *synchronizer = (PosixAsyncSynchronizer *)(sigev_value.sival_ptr);

    pthread_mutex_lock(&PosixFileAccess::asyncmutex);
    PosixAsyncIOContext *context = synchronizer->context;
    struct aiocb *aiocbp = synchronizer->aiocb;

    if (!context)
    {
        LOG_debug << "Async IO request already cancelled";
        delete synchronizer;
        delete aiocbp;
        pthread_mutex_unlock(&PosixFileAccess::asyncmutex);
        return;
    }

    context->synchronizer = NULL;
    context->failed = aio_error(aiocbp);
    if (!context->failed)
    {
        if (context->op == AsyncIOContext::READ)
        {
            memset((void *)(((char *)(aiocbp->aio_buf)) + aiocbp->aio_nbytes), 0, context->pad);
            LOG_verbose << "Async read finished OK";
        }
        else
        {
            LOG_verbose << "Async write finished OK";
        }
    }
    else
    {
        LOG_warn << "Async operation finished with error";
    }

    delete synchronizer;
    delete aiocbp;

    context->retry = false;
    context->finished = true;
    if (context->userCallback)
    {
        context->userCallback(context->userData);
    }
    pthread_mutex_unlock(&PosixFileAccess::asyncmutex);
}

void PosixFileAccess::asyncsysopen(AsyncIOContext *context)
{
    if (context->access & AsyncIOContext::ACCESS_READ)
    {
        string path;
        path.assign((char *)context->buffer, context->len);
        fopen(&path, true, false); // set size & mtime
    }

    EM_ASM_({
        FileAccess.open($0, $1);
    }, context, onAsyncFinished);
}

void PosixFileAccess::asyncsysread(AsyncIOContext *context)
{
    if (!context)
    {
        return;
    }

    LOG_info << "asyncsysread";

    EM_ASM_({
        FileAccess.read($0, $1);
    }, context, onAsyncFinished);

#if 0
    PosixAsyncIOContext *posixContext = dynamic_cast<PosixAsyncIOContext*>(context);
    if (!posixContext)
    {
        context->failed = true;
        context->retry = false;
        context->finished = true;
        if (context->userCallback)
        {
            context->userCallback(context->userData);
        }
        return;
    }

    struct aiocb *aiocbp = new struct aiocb;
    memset(aiocbp, 0, sizeof (struct aiocb));

    aiocbp->aio_fildes = fd;
    aiocbp->aio_buf = (void *)posixContext->buffer;
    aiocbp->aio_nbytes = posixContext->len;
    aiocbp->aio_offset = posixContext->pos;

    PosixAsyncSynchronizer *synchronizer = new PosixAsyncSynchronizer();
    synchronizer->aiocb = aiocbp;
    synchronizer->context = posixContext;
    posixContext->synchronizer = synchronizer;

    aiocbp->aio_sigevent.sigev_notify = SIGEV_THREAD;
    aiocbp->aio_sigevent.sigev_value.sival_ptr = (void *)synchronizer;
    aiocbp->aio_sigevent.sigev_notify_function = asyncopfinished;

    if (aio_read(aiocbp))
    {
        LOG_warn << "Async read failed at startup";
        posixContext->failed = true;
        posixContext->retry = false;
        posixContext->finished = true;
        posixContext->synchronizer = NULL;
        delete synchronizer;
        delete aiocbp;

        if (posixContext->userCallback)
        {
            posixContext->userCallback(posixContext->userData);
        }
    }
#endif
}

void PosixFileAccess::asyncsyswrite(AsyncIOContext *context)
{
    if (!context)
    {
        return;
    }

    EM_ASM_({
        FileAccess.write($0, $1);
    }, context, onAsyncFinished);

#if 0
    PosixAsyncIOContext *posixContext = dynamic_cast<PosixAsyncIOContext*>(context);
    if (!posixContext)
    {
        context->failed = true;
        context->retry = false;
        context->finished = true;
        if (context->userCallback)
        {
            context->userCallback(context->userData);
        }
        return;
    }

    struct aiocb *aiocbp = new struct aiocb;
    memset(aiocbp, 0, sizeof (struct aiocb));

    aiocbp->aio_fildes = fd;
    aiocbp->aio_buf = (void *)posixContext->buffer;
    aiocbp->aio_nbytes = posixContext->len;
    aiocbp->aio_offset = posixContext->pos;

    PosixAsyncSynchronizer *synchronizer = new PosixAsyncSynchronizer();
    synchronizer->aiocb = aiocbp;
    synchronizer->context = posixContext;
    posixContext->synchronizer = synchronizer;

    aiocbp->aio_sigevent.sigev_notify = SIGEV_THREAD;
    aiocbp->aio_sigevent.sigev_value.sival_ptr = (void *)synchronizer;
    aiocbp->aio_sigevent.sigev_notify_function = asyncopfinished;

    if (aio_write(aiocbp))
    {
        LOG_warn << "Async read failed at startup";
        posixContext->failed = true;
        posixContext->retry = false;
        posixContext->finished = true;
        posixContext->synchronizer = NULL;
        delete synchronizer;
        delete aiocbp;

        if (posixContext->userCallback)
        {
            posixContext->userCallback(posixContext->userData);
        }
    }
#endif
}

// update local name
void PosixFileAccess::updatelocalname(string* name)
{
    if (localname.size())
    {
        localname = *name;
    }
}

bool PosixFileAccess::sysread(byte*, unsigned, m_off_t)
{
    LOG_warn << "sysread";
    // Not required for Javascript
    return false;
}

bool PosixFileAccess::fwrite(const byte*, unsigned, m_off_t)
{
    LOG_warn << "fwrite";
    // Not required for Javascript
    return false;
}

bool PosixFileAccess::fopen(string* f, bool read, bool write)
{
    retry = false;

    LOG_verbose << "fopen -- " << f->c_str() << " " << read << write;

    if (!write)
    {
        #warning folder upload
        type = /*S_ISDIR(statbuf.st_mode) ? FOLDERNODE :*/ FILENODE;
        // fsid = (handle)statbuf.st_ino;
        // fsidvalid = true;

        localname.resize(1);
        updatelocalname(f);

        return sysstat(&mtime, &size);
    }

    return false;
}

PosixFileSystemAccess::PosixFileSystemAccess(int fseventsfd)
{
#ifndef EMSCRIPTEN
    assert(sizeof(off_t) == 8);
#endif

    notifyerr = false;
    notifyfailed = true;
    notifyfd = -1;

    localseparator = "/";

    LOG_info << "PosixFileSystemAccess::PosixFileSystemAccess";
}

PosixFileSystemAccess::~PosixFileSystemAccess()
{
    LOG_info << "PosixFileSystemAccess::~PosixFileSystemAccess";
#ifndef EMSCRIPTEN
    if (notifyfd >= 0)
    {
        close(notifyfd);
    }
#endif
}

// wake up from filesystem updates
void PosixFileSystemAccess::addevents(Waiter* w, int flags)
{
#ifndef EMSCRIPTEN
    if (notifyfd >= 0)
    {
        PosixWaiter* pw = (PosixWaiter*)w;

        FD_SET(notifyfd, &pw->rfds);
        FD_SET(notifyfd, &pw->ignorefds);

        pw->bumpmaxfd(notifyfd);
    }
#endif
}

// read all pending inotify events and queue them for processing
int PosixFileSystemAccess::checkevents(Waiter* w)
{
    return 0;
}

// generate unique local filename in the same fs as relatedpath
void PosixFileSystemAccess::tmpnamelocal(string* localname) const
{
    static unsigned tmpindex;
    char buf[32];

    sprintf(buf, ".getxfer.%04x.mega", tmpindex++);
    *localname = buf;

    LOG_verbose << "PosixFileSystemAccess::tmpnamelocal -- " << buf;
}

void PosixFileSystemAccess::path2local(string* local, string* path) const
{
    *path = *local;
}

void PosixFileSystemAccess::local2path(string* local, string* path) const
{
    *path = *local;
    normalize(path);
}

// no legacy DOS garbage here...
bool PosixFileSystemAccess::getsname(string*, string*) const
{
    return false;
}

bool PosixFileSystemAccess::renamelocal(string* oldname, string* newname, bool)
{
    // XXX: this should be async

    EM_ASM_({
        FileAccess.save($0, $1);
    }, oldname->c_str(), newname->c_str());
    return true;
}

bool PosixFileSystemAccess::copylocal(string* oldname, string* newname, m_time_t mtime)
{
    LOG_debug << "Dummy copylocal: " << oldname->c_str() << " to " << newname->c_str();
    return false;
}

// FIXME: add platform support for recycle bins
bool PosixFileSystemAccess::rubbishlocal(string* name)
{
    return false;
}

bool PosixFileSystemAccess::unlinklocal(string* name)
{
    // XXX: this should be async

    int r = EM_ASM_INT({
        return FileAccess.unlink($0);
    }, name->c_str());

    return !!r;
}

// delete all files, folders and symlinks contained in the specified folder
// (does not recurse into mounted devices)
void PosixFileSystemAccess::emptydirlocal(string* name, dev_t basedev)
{
    LOG_debug << "Dummy emptydirlocal: " << name->c_str() << " " << basedev;
}

bool PosixFileSystemAccess::rmdirlocal(string* name)
{
#ifndef EMSCRIPTEN
    emptydirlocal(name);

    if (!rmdir(name->c_str())) return true;

    transient_error = errno == ETXTBSY || errno == EBUSY;
#endif
    return false;
}

bool PosixFileSystemAccess::mkdirlocal(string* name, bool)
{
    bool r = false;

#ifndef EMSCRIPTEN
    if (!(r = !mkdir(name->c_str(), 0700)))
    {
        target_exists = errno == EEXIST;
        transient_error = errno == ETXTBSY || errno == EBUSY;
    }
#endif
    return r;
}

bool PosixFileSystemAccess::setmtimelocal(string* name, m_time_t mtime)
{
    unsigned time = mtime & 0xffffffff;

    int success = EM_ASM_INT({
        return FileAccess.utime($0, $1);
    }, name->c_str(), time);

    return !!success;
}

bool PosixFileSystemAccess::chdirlocal(string* name) const
{
    return !chdir(name->c_str());
}

size_t PosixFileSystemAccess::lastpartlocal(string* localname) const
{
    const char* ptr = localname->data();

    if ((ptr = strrchr(ptr, '/')))
    {
        return ptr - localname->data() + 1;
    }

    return 0;
}

// return lowercased ASCII file extension, including the . separator
bool PosixFileSystemAccess::getextension(string* filename, char* extension, int size) const
{
    const char* ptr = filename->data() + filename->size();
    char c;
    int i, j;

    size--;

    if (size > filename->size())
    {
        size = filename->size();
    }

    for (i = 0; i < size; i++)
    {
        if (*--ptr == '.')
        {
            for (j = 0; j <= i; j++)
            {
                if (*ptr < '.' || *ptr > 'z') return false;

                c = *(ptr++);

                // tolower()
                if (c >= 'A' && c <= 'Z') c |= ' ';

                extension[j] = c;
            }

            extension[j] = 0;

            return true;
        }
    }

    return false;
}

void PosixFileSystemAccess::osversion(string* u) const
{
    utsname uts;

    if (!uname(&uts))
    {
        u->append(uts.sysname);
        u->append(" ");
        u->append(uts.release);
        u->append(" ");
        u->append(uts.machine);
    }
}

PosixDirNotify::PosixDirNotify(string* localbasepath, string* ignore) : DirNotify(localbasepath, ignore)
{
#ifdef USE_INOTIFY
    failed = false;
#endif

#ifdef __MACH__
    failed = false;
#endif

    fsaccess = NULL;
}

void PosixDirNotify::addnotify(LocalNode* l, string* path)
{
#ifdef ENABLE_SYNC
#ifdef USE_INOTIFY
    int wd;

    wd = inotify_add_watch(fsaccess->notifyfd, path->c_str(),
                           IN_CREATE | IN_DELETE | IN_MOVED_FROM | IN_MOVED_TO
                           | IN_CLOSE_WRITE | IN_EXCL_UNLINK | IN_ONLYDIR);

    if (wd >= 0)
    {
        l->dirnotifytag = (handle)wd;
        fsaccess->wdnodes[wd] = l;
    }
#endif
#endif
}

void PosixDirNotify::delnotify(LocalNode* l)
{
#ifdef ENABLE_SYNC
#ifdef USE_INOTIFY
    if (fsaccess->wdnodes.erase((int)(long)l->dirnotifytag))
    {
        inotify_rm_watch(fsaccess->notifyfd, (int)l->dirnotifytag);
    }
#endif
#endif
}

fsfp_t PosixDirNotify::fsfingerprint()
{
    struct statfs statfsbuf;

    // FIXME: statfs() does not really do what we want.
    if (statfs(localbasepath.c_str(), &statfsbuf)) return 0;

    return *(fsfp_t*)&statfsbuf.f_fsid + 1;
}

FileAccess* PosixFileSystemAccess::newfileaccess()
{
    return new PosixFileAccess(waiter);
}

DirAccess* PosixFileSystemAccess::newdiraccess()
{
    return new PosixDirAccess();
}

DirNotify* PosixFileSystemAccess::newdirnotify(string* localpath, string* ignore)
{
    PosixDirNotify* dirnotify = new PosixDirNotify(localpath, ignore);

    dirnotify->fsaccess = this;

    return dirnotify;
}

bool PosixDirAccess::dopen(string* path, FileAccess* f, bool doglob)
{
#ifndef EMSCRIPTEN
    if (doglob)
    {
        if (glob(path->c_str(), GLOB_NOSORT, NULL, &globbuf))
        {
            return false;
        }

        globbing = true;
        globindex = 0;

        return true;
    }

    if (f)
    {
#ifdef HAVE_FDOPENDIR
        dp = fdopendir(((PosixFileAccess*)f)->fd);
        ((PosixFileAccess*)f)->fd = -1;
#else
        dp = ((PosixFileAccess*)f)->dp;
        ((PosixFileAccess*)f)->dp = NULL;
#endif
    }
    else
    {
        dp = opendir(path->c_str());
    }
#endif
    return dp != NULL;
}

bool PosixDirAccess::dnext(string* path, string* name, bool followsymlinks, nodetype_t* type)
{
#ifndef EMSCRIPTEN
    if (globbing)
    {
        struct stat statbuf;

        while (globindex < globbuf.gl_pathc)
        {
            if (!stat(globbuf.gl_pathv[globindex++], &statbuf))
            {
                if (statbuf.st_mode & (S_IFREG | S_IFDIR))
                {
                    *name = globbuf.gl_pathv[globindex - 1];
                    *type = (statbuf.st_mode & S_IFREG) ? FILENODE : FOLDERNODE;

                    return true;
                }
            }
        }

        return false;
    }

    dirent* d;
    size_t pathsize = path->size();
    struct stat statbuf;

    path->append("/");

    while ((d = readdir(dp)))
    {
        if (*d->d_name != '.' || (d->d_name[1] && (d->d_name[1] != '.' || d->d_name[2])))
        {
            path->append(d->d_name);

            if (followsymlinks ? !stat(path->c_str(), &statbuf) : !lstat(path->c_str(), &statbuf))
            {
                if (S_ISREG(statbuf.st_mode) || S_ISDIR(statbuf.st_mode))
                {
                    path->resize(pathsize);
                    *name = d->d_name;

                    if (type)
                    {
                        *type = S_ISREG(statbuf.st_mode) ? FILENODE : FOLDERNODE;
                    }

                    return true;
                }
            }

            path->resize(pathsize+1);
        }
    }

    path->resize(pathsize);
#endif
    return false;
}

PosixDirAccess::PosixDirAccess()
{
    dp = NULL;
    globbing = false;
    memset(&globbuf, 0, sizeof(glob_t));
    globindex = 0;
}

PosixDirAccess::~PosixDirAccess()
{
#ifndef EMSCRIPTEN
    if (dp)
    {
        closedir(dp);
    }

    if (globbing)
    {
        globfree(&globbuf);
    }
#endif
}
} // namespace
