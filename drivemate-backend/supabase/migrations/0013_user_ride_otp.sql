-- Migration to add ride_otp column for customers to share with drivers
alter table users add column ride_otp text;

-- Update existing customers to have a default fixed OTP '1234'
update users set ride_otp = '1234' where role = 'customer' and ride_otp is null;
