#include <time.h>
#include <megaapi.h>
#include <unistd.h>
#include <stdio.h>

using namespace mega;

int main()
{
	MegaApi::setLogLevel(MegaApi::LOG_LEVEL_MAX);
	MegaApi *api = new MegaApi("1234567");
	api->login("jssdk@yopmail.com", "jssdktest");
}

