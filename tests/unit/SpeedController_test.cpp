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

TEST(SpeedController, calculateMeanSpeed)
{
    SpeedController speedController;
    constexpr auto totalBytes{10};

    Waiter::ds = 0;
    EXPECT_EQ(speedController.calculateSpeed(totalBytes), 2);
    EXPECT_EQ(speedController.getMeanSpeed(), 1);

    constexpr auto zeroBytes{0};
    EXPECT_EQ(speedController.calculateSpeed(zeroBytes), 2);
    EXPECT_EQ(speedController.getMeanSpeed(), 1);

    // handle wrong values correctly
    constexpr auto negativeBytes{-100};
    EXPECT_EQ(speedController.calculateSpeed(negativeBytes), 2);
    EXPECT_EQ(speedController.getMeanSpeed(), 1);

    EXPECT_EQ(speedController.calculateSpeed(totalBytes), 4);
    EXPECT_EQ(speedController.getMeanSpeed(), 2);

    Waiter::ds = 1;
    EXPECT_EQ(speedController.calculateSpeed(totalBytes), 6);
    EXPECT_EQ(speedController.getMeanSpeed(), 3);

    Waiter::ds = SpeedController::SPEED_INTERVAL_DS-1;
    EXPECT_EQ(speedController.calculateSpeed(totalBytes), 8);
    EXPECT_EQ(speedController.getMeanSpeed(), 4);

    Waiter::ds = SpeedController::SPEED_MEAN_DEFAULT_INTERVAL_DS - 1;
    EXPECT_EQ(speedController.calculateSpeed(totalBytes), 2);
    EXPECT_EQ(speedController.getMeanSpeed(), 5);

    Waiter::ds += SpeedController::SPEED_MEAN_DEFAULT_INTERVAL_DS;
    EXPECT_EQ(speedController.calculateSpeed(totalBytes), 2);
    EXPECT_EQ(speedController.getMeanSpeed(), 1);
}

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
        Waiter::ds += SpeedController::SPEED_INTERVAL_DS;
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
    EXPECT_EQ(speedController.getMeanSpeed(), 10000); // mean in 10 seconds window

    Waiter::ds += SpeedController::SPEED_INTERVAL_DS;
    for(int i=0; i<10000; i++)
    {
        speed = speedController.calculateSpeed(totalBytes);
    }
    EXPECT_EQ(speed, 20000); // 10*10000 bytes in 5 seconds is 2*10000 bytes in 1 second
    EXPECT_EQ(speedController.getMeanSpeed(), 20000);
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
        EXPECT_EQ(speedController.getMeanSpeed(), 1);
        Waiter::ds += SpeedController::SPEED_INTERVAL_DS*2;
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
        Waiter::ds += SpeedController::SPEED_INTERVAL_DS;
        auto speed{speedController.calculateSpeed(totalBytes)};
        EXPECT_EQ(speed, 2); // 10 bytes in 5 seconds is 2 bytes in 1 second            
    }
    EXPECT_EQ(speedController.getMeanSpeed(), 2);

    constexpr auto zeroBytes{0};
    for(auto i=0; i < totalCalculations; i++)
    {
        const auto speed{speedController.calculateSpeed(zeroBytes)};
        EXPECT_EQ(speed, 2);
        EXPECT_EQ(speedController.getMeanSpeed(), 2);
    }

    Waiter::ds += SpeedController::SPEED_INTERVAL_DS;
    auto speed{speedController.calculateSpeed(zeroBytes)};
    EXPECT_EQ(speed, 0);
    EXPECT_EQ(speedController.getMeanSpeed(), 1);

    Waiter::ds += SpeedController::SPEED_INTERVAL_DS;
    speed = speedController.calculateSpeed(zeroBytes);
    EXPECT_EQ(speed, 0);
    EXPECT_EQ(speedController.getMeanSpeed(), 0);
}

TEST(SpeedController, calculateMeanSpeedSmallBytesValue)
{
    Waiter::ds = 0;
    SpeedController speedController;
    constexpr auto totalBytes{5};

    for(int i=0; i<10000; i++)
    {
        Waiter::ds += SpeedController::SPEED_INTERVAL_DS;
        const auto speed{speedController.calculateSpeed(totalBytes)};
        EXPECT_EQ(speed, 1); // 5 bytes in 5 seconds is 1 bytes in 1 second        
    }
    EXPECT_EQ(speedController.getMeanSpeed(), 1);

    const auto speed = speedController.calculateSpeed(4);
    EXPECT_EQ(speed, 1); // 4 bytes in 5 seconds is 0 bytes in 1 second
    EXPECT_EQ(speedController.getMeanSpeed(), 1);
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
    EXPECT_EQ(speedController.getMeanSpeed(), 100);

    const auto elapsed{end-start};
    const auto micros{std::chrono::duration_cast<std::chrono::microseconds>(elapsed).count()/totalCalculations};
    std::cout << "[          ] time micros = " << micros << std::endl;
    // time micros = 0.079198 in a Intel® Core™ i7-9750H CPU @ 2.60GHz × 12 (Release)
}
