/**
 * (c) 2019 by Mega Limited, Wellsford, New Zealand
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
#include "gtest/gtest.h"

using namespace mega;

TEST(SpeedController, calculateMeanSpeedOneSamplePerTimeInterval)
{
    // calculate speed only once per time interval, SPEED_MEAN_INTERVAL_DS = 50 (5secs)
    Waiter::ds = 0;
    SpeedController speedController;
    constexpr auto totalBytes{10};

    m_off_t speed;
    for(int i=0; i<10000; i++)
    {
        speed = speedController.calculateSpeed(totalBytes);
        EXPECT_EQ(speed, 2); // 10 bytes in 5 seconds is 2 bytes in 1 second
        EXPECT_EQ(speedController.getMeanSpeed(), 2);
        Waiter::ds += SpeedController::SPEED_MEAN_INTERVAL_DS;
    }
    EXPECT_EQ(speedController.getMeanSpeed(), 2);
}

TEST(SpeedController, calculateMeanSpeedThounsendSamplesPerTimeInterval)
{
    // A lot of measurements done in the same time interval, SPEED_MEAN_INTERVAL_DS = 50 (5secs)
    Waiter::ds = 0;
    SpeedController speedController;
    constexpr auto totalBytes{10};

    m_off_t speed;
    for(int i=0; i<10000; i++)
    {
        speed = speedController.calculateSpeed(totalBytes);
    }
    EXPECT_EQ(speed, 20000); // 10*10000 bytes in 5 seconds is 2*10000 bytes in 1 second
    EXPECT_EQ(speedController.getMeanSpeed(), 10001);
    // this is a mean of last 10000 speed calculations recived but it does not take into account when they were received
    // could be far ago, so it would be not very usefull. Hopefully transfers do not stop for a long time, but still is not correct.

    Waiter::ds += SpeedController::SPEED_MEAN_INTERVAL_DS;
    for(int i=0; i<10000; i++)
    {
        speed = speedController.calculateSpeed(totalBytes);
    }
    EXPECT_EQ(speed, 20000); // 10*10000 bytes in 5 seconds is 2*10000 bytes in 1 second
    EXPECT_EQ(speedController.getMeanSpeed(), 8334);
}

TEST(SpeedController, calculateMeanSpeedJumpingTimeSlots)
{
    // Lets try what happen if there is no samples in between time slots
    Waiter::ds = 0;
    SpeedController speedController;
    constexpr auto totalBytes{10};

    for(int i=0; i<10000; i++)
    {
        auto speed{speedController.calculateSpeed(totalBytes)};
        EXPECT_EQ(speed, 2); // 5 bytes in 5 seconds is 1 bytes in 1 second
        EXPECT_EQ(speedController.getMeanSpeed(), 2);
        Waiter::ds += SpeedController::SPEED_MEAN_INTERVAL_DS*2;
    }
}

TEST(SpeedController, calculateMeanSpeedAfterReceivingZeroBytes)
{
    // What happen if zero bytes are received
    Waiter::ds = 0;
    SpeedController speedController;

    auto totalBytes(10);
    constexpr auto totalCalculations{25};
    for(auto i=0; i < totalCalculations; i++)
    {
        auto speed{speedController.calculateSpeed(totalBytes)};
        EXPECT_EQ(speed, 2); // 10 bytes in 5 seconds is 2 bytes in 1 second
        Waiter::ds += SpeedController::SPEED_MEAN_INTERVAL_DS;
        EXPECT_EQ(speedController.getMeanSpeed(), 2);
    }

    totalBytes = 0;
    for(auto i=0; i < totalCalculations; i++)
    {
        auto speed{speedController.calculateSpeed(totalBytes)};
        EXPECT_EQ(speed, 0); // 0 bytes in 5 seconds is 0 bytes in 1 second
        Waiter::ds += SpeedController::SPEED_MEAN_INTERVAL_DS;
        EXPECT_EQ(speedController.getMeanSpeed(), 2); // 0 bytes does not count for mean calculation
    }
}

TEST(SpeedController, calculateMeanSpeedThreeSamplesPerTimeInterval)
{
    // Let's do a more complete use case
    Waiter::ds = 0;
    SpeedController speedController;
    constexpr auto totalBytes{10};

    auto speed{speedController.calculateSpeed(totalBytes)};
    EXPECT_EQ(speed, 2); // 10 bytes in 5 seconds is 2 bytes in 1 second
    EXPECT_EQ(speedController.getMeanSpeed(), 2);

    speed = speedController.calculateSpeed(totalBytes);
    EXPECT_EQ(speed, 4); // 20 bytes in 5 seconds is 4 bytes in 1 second
    EXPECT_EQ(speedController.getMeanSpeed(), 3); // mean of 2 and 4

    speed = speedController.calculateSpeed(totalBytes);
    EXPECT_EQ(speed, 6); // 30 bytes in 5 seconds is 6 bytes in 1 second
    EXPECT_EQ(speedController.getMeanSpeed(), 4); // mean of 2, 4 and 6

    // now the new calculation will be done in a different time interval
    Waiter::ds += SpeedController::SPEED_MEAN_INTERVAL_DS;
    speed = speedController.calculateSpeed(totalBytes);
    EXPECT_EQ(speed, 2); // 10 bytes in 5 seconds is 4 bytes in 1 second
    EXPECT_EQ(speedController.getMeanSpeed(), 3); // mean of 2, 4, 6 and 2 (3.5)

    speed = speedController.calculateSpeed(totalBytes);
    EXPECT_EQ(speed, 4); // 20 bytes in 5 seconds is 4 bytes in 1 second
    EXPECT_EQ(speedController.getMeanSpeed(), 3); // mean of 2, 4, 6, 2 and 4 (3.6)

    speed = speedController.calculateSpeed(totalBytes);
    EXPECT_EQ(speed, 6); // 30 bytes in 5 seconds is 6 bytes in 1 second
    EXPECT_EQ(speedController.getMeanSpeed(), 3); // WRONG!
    // this mean should be 4: mean of 2, 4, 6, 2, 4 and 6

    // now the new calculation will be done in a different time interval
    Waiter::ds += SpeedController::SPEED_MEAN_INTERVAL_DS;
    speed = speedController.calculateSpeed(totalBytes);
    EXPECT_EQ(speed, 2); // 10 bytes in 5 seconds is 4 bytes in 1 second
    EXPECT_EQ(speedController.getMeanSpeed(), 2); // mean of 3x6 and 2

    speed = speedController.calculateSpeed(totalBytes);
    EXPECT_EQ(speed, 4); // 20 bytes in 5 seconds is 4 bytes in 1 second
    EXPECT_EQ(speedController.getMeanSpeed(), 2); // mean of 2x6 and 4

    speed = speedController.calculateSpeed(totalBytes);
    EXPECT_EQ(speed, 6); // 30 bytes in 5 seconds is 6 bytes in 1 second
    EXPECT_EQ(speedController.getMeanSpeed(), 2); // mean of 2x7 and 6

    // now the new calculation will be done in a different time interval
    Waiter::ds += SpeedController::SPEED_MEAN_INTERVAL_DS;
    speed = speedController.calculateSpeed(0);
    EXPECT_EQ(speed, 0); // 0 bytes in 5 seconds is 0 bytes in 1 second
    EXPECT_EQ(speedController.getMeanSpeed(), 2); // last mean

    // now the new calculation will be done in a different time interval
    Waiter::ds += SpeedController::SPEED_MEAN_INTERVAL_DS;
    speed = speedController.calculateSpeed(0);
    EXPECT_EQ(speed, 0); // 0 bytes in 5 seconds is 0 bytes in 1 second
    EXPECT_EQ(speedController.getMeanSpeed(), 2); // last mean

    // now the new calculation will be done in a different time interval
    Waiter::ds += SpeedController::SPEED_MEAN_INTERVAL_DS;
    speed = speedController.calculateSpeed(totalBytes);
    EXPECT_EQ(speed, 2); // 10 bytes in 5 seconds is 2 bytes in 1 second
    EXPECT_EQ(speedController.getMeanSpeed(), 2); // mean of 2x8 and 2

    speed = speedController.calculateSpeed(totalBytes);
    EXPECT_EQ(speed, 4); // 20 bytes in 5 seconds is 4 bytes in 1 second
    EXPECT_EQ(speedController.getMeanSpeed(), 2); // mean of 2x9 and 4

    speed = speedController.calculateSpeed(totalBytes);
    EXPECT_EQ(speed, 6); // 30 bytes in 5 seconds is 6 bytes in 1 second
    EXPECT_EQ(speedController.getMeanSpeed(), 2); // mean of 2x10 and 6

    // now the new calculation will be done in a different time interval
    Waiter::ds += SpeedController::SPEED_MEAN_INTERVAL_DS;
    speed = speedController.calculateSpeed(1);
    EXPECT_EQ(speed, 0); // 1 bytes in 5 seconds is 0.2 bytes in 1 second
    EXPECT_EQ(speedController.getMeanSpeed(), 1); // mean of 2x11 and 0

    speed = speedController.calculateSpeed(1);
    EXPECT_EQ(speed, 0); // 2 bytes in 5 seconds is 0.4 bytes in 1 second
    EXPECT_EQ(speedController.getMeanSpeed(), 0); // mean of 1x12 and 0

    speed = speedController.calculateSpeed(1);
    EXPECT_EQ(speed, 0); // 3 bytes in 5 seconds is 0.6 bytes in 1 second
    EXPECT_EQ(speedController.getMeanSpeed(), 0); // mean of 0x13 and 0

    // Calculating speed with samples lower than 5 bytes will bring the mean to zero
}

TEST(SpeedController, calculateMeanSpeedSmallTimeIntervals)
{
    Waiter::ds = 0;
    SpeedController speedController;
    auto totalBytes(10);

    auto speed{speedController.calculateSpeed(totalBytes)};
    EXPECT_EQ(speed, 2); // 10 bytes in 5 seconds is 2 bytes in 1 second
    EXPECT_EQ(speedController.getMeanSpeed(), 2);

    Waiter::ds++;
    speed = speedController.calculateSpeed(totalBytes);
    EXPECT_EQ(speed, 4); // 20 bytes in 5 seconds is 4 bytes in 1 second
    EXPECT_EQ(speedController.getMeanSpeed(), 3); // mean of 2 and 4

    Waiter::ds++;
    speed = speedController.calculateSpeed(totalBytes);
    EXPECT_EQ(speed, 6); // 30 bytes in 5 seconds is 6 bytes in 1 second
    EXPECT_EQ(speedController.getMeanSpeed(), 4); // mean of 3x2 and 6

    // now the new calculation will be done in a different time interval
    Waiter::ds += SpeedController::SPEED_MEAN_INTERVAL_DS;
    speed = speedController.calculateSpeed(totalBytes);
    EXPECT_EQ(speed, 2); // 10 bytes in 5 seconds is 4 bytes in 1 second
    EXPECT_EQ(speedController.getMeanSpeed(), 3); // mean of 4x3 and 2

    Waiter::ds++;
    speed = speedController.calculateSpeed(totalBytes);
    EXPECT_EQ(speed, 4); // 20 bytes in 5 seconds is 4 bytes in 1 second
    EXPECT_EQ(speedController.getMeanSpeed(), 3); // mean of 2 and 4

    Waiter::ds++;
    speed = speedController.calculateSpeed(totalBytes);
    EXPECT_EQ(speed, 6); // 30 bytes in 5 seconds is 6 bytes in 1 second
    EXPECT_EQ(speedController.getMeanSpeed(), 3); // mean of 3x2 and 6
}

TEST(SpeedController, calculateMeanSpeedSmallBytesValue)
{
    Waiter::ds = 0;
    SpeedController speedController;
    constexpr auto totalBytes{5};

    m_off_t speed;
    for(int i=0; i<10000; i++)
    {
        const auto speed{speedController.calculateSpeed(totalBytes)};
        EXPECT_EQ(speed, 1); // 5 bytes in 5 seconds is 1 bytes in 1 second
        EXPECT_EQ(speedController.getMeanSpeed(), 1);
        Waiter::ds += SpeedController::SPEED_MEAN_INTERVAL_DS;
    }

    // after ten thousend values a simple value less than 5 bytes
    // force the mean speed to be zero. This isn't right, is it?
    speed = speedController.calculateSpeed(4);
    EXPECT_EQ(speed, 0); // 4 bytes in 5 seconds is 0 bytes in 1 second
    EXPECT_EQ(speedController.getMeanSpeed(), 0); // mean of 1x100000 and 0
}

TEST(SpeedController, calculateSpeedPerformance)
{
    SpeedController speedController;
    constexpr auto totalBytes(10);
    constexpr auto totalCalculations(1e6);
    Waiter::ds = 0;

    const auto start{std::chrono::steady_clock::now()};
    m_off_t speed;
    for(int i=0; i<totalCalculations; i++)
    {
        speed = speedController.calculateSpeed(totalBytes);
        Waiter::ds += 1;
    }
    const auto end{std::chrono::steady_clock::now()};

    EXPECT_EQ(speed, 100);
    EXPECT_EQ(speedController.getMeanSpeed(), 51);

    const auto elapsed{end-start};
    const auto micros{std::chrono::duration_cast<std::chrono::microseconds>(elapsed).count()/totalCalculations};
    std::cout << "[          ] time micros = " << micros << std::endl;
    // time micros = 0.045727 in a Intel® Core™ i7-9750H CPU @ 2.60GHz × 12
}
}
