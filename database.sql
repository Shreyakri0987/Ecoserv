DROP DATABASE IF EXISTS ecoserv_db;
CREATE DATABASE ecoserv_db;
USE ecoserv_db;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('user', 'collector', 'admin') DEFAULT 'user',
    full_name VARCHAR(100) DEFAULT NULL,
    phone VARCHAR(20) DEFAULT NULL,
    avatar_color VARCHAR(7) DEFAULT '#10b981',
    eco_points INT DEFAULT 0,
    level INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    user_email VARCHAR(255),
    waste_type VARCHAR(50),
    weight INT,
    pickup_date DATE,
    address TEXT,
    notes TEXT DEFAULT NULL,
    status ENUM('Pending','Scheduled','Collected','Recycled') DEFAULT 'Pending',
    collector_id INT DEFAULT NULL,
    collector_name VARCHAR(100) DEFAULT NULL,
    progress INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (collector_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    message TEXT NOT NULL,
    type ENUM('info','success','warning','update') DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE activity_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(255),
    points_earned INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE user_badges (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    badge_name VARCHAR(100),
    badge_icon VARCHAR(10),
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO users (email, password, role, full_name, eco_points, level, avatar_color) VALUES
('admin@ecoserv.com',      'admin123',   'admin',     'EcoServ Admin', 9999, 10, '#10b981'),
('collector1@ecoserv.com', 'collect123', 'collector', 'Ravi Kumar',     500,  3, '#3b82f6'),
('collector2@ecoserv.com', 'collect123', 'collector', 'Meena Devi',     320,  2, '#8b5cf6'),
('priya@demo.com',         'demo123',    'user',      'Priya Sharma',  1250,  5, '#f59e0b'),
('rahul@demo.com',         'demo123',    'user',      'Rahul Verma',    980,  4, '#ef4444');

INSERT INTO notifications (user_id, message, type) VALUES
(1, 'EcoServ is live! 2 collectors and demo users created.', 'success'),
(2, 'Welcome Ravi! You are now a waste collector. Check your Assignments tab. 🚚', 'success'),
(3, 'Welcome Meena! Your collector account is active. Check your Assignments tab. 🚚', 'success');
