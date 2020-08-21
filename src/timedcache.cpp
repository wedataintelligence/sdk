#include "mega/timedcache.h"

void TimedCache::addTimedValues(mega::dstime decisecondTimestamp, m_off_t values)
{
    const auto timestampChanged{lastAddedTimestamp != decisecondTimestamp};
    if(timestampChanged)
    {
        // add total count in last timeStamp bucket
        values += mTimedValues.rbegin()->second;
    }
    mTimedValues[decisecondTimestamp] += values;

    const auto windowTime{decisecondTimestamp - mTimedValues.begin()->first};
    const auto maxWindowTimeReached{windowTime > mMaxWindowTimeDeciseconds};
    if(maxWindowTimeReached)
    {
        // remove values outside the max window
        const auto initWindowTimestamp{decisecondTimestamp - mMaxWindowTimeDeciseconds};
        const auto lowerBoundIterator{mTimedValues.lower_bound(initWindowTimestamp)};
        removedValues += std::prev(lowerBoundIterator)->second;
        mTimedValues.erase(mTimedValues.begin(), lowerBoundIterator);
    }
}

m_off_t TimedCache::getTimedValues(mega::dstime windowTimeDeciseconds)
{
    if(mTimedValues.empty())
    {
        return 0;
    }

    windowTimeDeciseconds = std::min(mMaxWindowTimeDeciseconds, windowTimeDeciseconds);
    const auto currentWindowTime{mTimedValues.rbegin()->first - mTimedValues.begin()->first + 1};
    const auto currentWindowTimeIsLessOrEqualThanRequired{currentWindowTime <= windowTimeDeciseconds};
    if(mTimedValues.size() == 1 || currentWindowTimeIsLessOrEqualThanRequired)
    {
        return mTimedValues.rbegin()->second - removedValues;
    }

    const auto initWindowTimestamp{mTimedValues.rbegin()->first - windowTimeDeciseconds};
    const auto lowerBoundIterator{mTimedValues.lower_bound(initWindowTimestamp)};
    const auto values{mTimedValues.rbegin()->second - lowerBoundIterator->second};
    return values - removedValues;
}
