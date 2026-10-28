CREATE DATABASE IF NOT EXISTS car_dealership;
USE car_dealership;

CREATE TABLE IF NOT EXISTS cars (
    id INT AUTO_INCREMENT PRIMARY KEY,
    brand VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    variant VARCHAR(100),
    year INT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    mileage_km INT,
    fuel_type VARCHAR(50),
    transmission VARCHAR(50),
    status ENUM('available', 'reserved', 'sold') DEFAULT 'available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);