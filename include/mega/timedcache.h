#pragma once
#include <cstdint>
#include <map>

class TimedCache
{
public:
    TimedCache(uint32_t maxWindowTimeDeciseconds);
    void addTimedValues(uint32_t decisecondTimestamp, int64_t values);
    int64_t getTimedValues(uint32_t windowTimeDeciseconds) const;

private:
    const uint32_t mMaxWindowTimeDeciseconds;
    std::map<uint32_t, int64_t> mTimedValues;
    int64_t removedValues{0};
};
