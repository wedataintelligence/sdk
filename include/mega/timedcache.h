#pragma once
#include "mega/http.h"
#include "mega/types.h"

class TimedCache
{
public:
    void addTimedValues(mega::dstime decisecondTimestamp, m_off_t values);

    m_off_t getTimedValues(mega::dstime windowTimeDeciseconds);
private:
    const mega::dstime mMaxWindowTimeDeciseconds{10*20}; // 20 seconds max
    mega::dstime lastAddedTimestamp{0};
    std::map<mega::dstime, m_off_t> mTimedValues;
    m_off_t removedValues{0};
};
