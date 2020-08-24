#include "mega/timedcache.h"

TimedCache::TimedCache(uint32_t maxWindowTimeDeciseconds)
    :mMaxWindowTimeDeciseconds{maxWindowTimeDeciseconds}
{
}

void TimedCache::addTimedValues(uint32_t decisecondTimestamp, int64_t values)
{
    if(mTimedValues.empty())
    {
        mTimedValues[decisecondTimestamp] = values;
        return;
    }

    const auto timestampChanged{mTimedValues.rbegin()->first != decisecondTimestamp};
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
        removedValues = std::prev(lowerBoundIterator)->second;
        mTimedValues.erase(mTimedValues.begin(), lowerBoundIterator);
    }
}

int64_t TimedCache::getTimedValues(uint32_t windowTimeDeciseconds) const
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

    const auto initWindowTimestamp{mTimedValues.rbegin()->first - windowTimeDeciseconds + 1};
    const auto lowerBoundIterator{mTimedValues.lower_bound(initWindowTimestamp)};
    const auto values{mTimedValues.rbegin()->second - std::prev(lowerBoundIterator)->second};
    return values;
}
