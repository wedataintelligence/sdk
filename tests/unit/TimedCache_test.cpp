#include "gtest/gtest.h"
#include "mega/timedcache.h"
#include <chrono>

TEST(TimedCache, storeAndRetrieveValues)
{
    TimedCache timedCache;
    EXPECT_EQ(timedCache.getTimedValues(5), 0);

    timedCache.addTimedValues(0, 10);
    EXPECT_EQ(timedCache.getTimedValues(5), 10);

    timedCache.addTimedValues(1, 10);
    EXPECT_EQ(timedCache.getTimedValues(5), 20);

    timedCache.addTimedValues(4, 10);
    EXPECT_EQ(timedCache.getTimedValues(5), 30);

    // values at timestamp 0 do not count
    timedCache.addTimedValues(5, 10);
    EXPECT_EQ(timedCache.getTimedValues(5), 30);

    // values at timestamp 1 do not count
    timedCache.addTimedValues(6, 10);
    EXPECT_EQ(timedCache.getTimedValues(5), 30);

    // return only values from timestamp 11
    timedCache.addTimedValues(11, 10);
    EXPECT_EQ(timedCache.getTimedValues(5), 10);

    // return only values from timestamp 200
    timedCache.addTimedValues(200, 10);
    EXPECT_EQ(timedCache.getTimedValues(5), 10);

    timedCache.addTimedValues(200, 10);
    EXPECT_EQ(timedCache.getTimedValues(5), 20);

    // return only values from timestamp 250
    timedCache.addTimedValues(250, 10);
    EXPECT_EQ(timedCache.getTimedValues(5), 10);

    timedCache.addTimedValues(250, 10);
    EXPECT_EQ(timedCache.getTimedValues(5), 20);

    // return only values from timestamp 1100
    timedCache.addTimedValues(11*100, 10);
    EXPECT_EQ(timedCache.getTimedValues(200), 10);
}

TEST(TimedCache, calculateTimedCachePerformance)
{
    TimedCache timedCache;
    constexpr auto values(10);
    constexpr auto totalCalculations(1e6);
    uint32_t timestampDeciseconds = 0;

    const auto start{std::chrono::steady_clock::now()};
    for(int i=0; i<totalCalculations; i++)
    {
        timedCache.addTimedValues(timestampDeciseconds, values);
        timedCache.getTimedValues(50);
        timestampDeciseconds++;
    }
    const auto end{std::chrono::steady_clock::now()};

    const auto elapsed{end - start};
    const auto micros{static_cast<double>(std::chrono::duration_cast<std::chrono::microseconds>(elapsed).count()) / totalCalculations};
    std::cout << "[          ] time micros = " << micros << std::endl;
    // time micros = 0.07073 in a Intel® Core™ i7-9750H CPU @ 2.60GHz × 12 (Release)
}
