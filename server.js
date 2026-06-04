'use strict';

const express    = require('express');
const mysql      = require('mysql2');
const cors       = require('cors');
const bodyParser = require('body-parser');
const path       = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// =============================================
// CONFIG — all values come from environment
// =============================================
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL   = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

if (!GROQ_API_KEY) {
    console.warn('⚠️  GROQ_API_KEY is not set — AI features will return fallback responses.');
}

// =============================================
// DATABASE
// =============================================
const db = mysql.createPool({
    host              : process.env.DB_HOST     || 'localhost',
    user              : process.env.DB_USER     || 'root',
    password          : process.env.DB_PASS     || 'root',
    database          : process.env.DB_NAME     || 'ecoserv_db',
    port              : parseInt(process.env.DB_PORT || '3306', 10),
    waitForConnections: true,
    connectionLimit   : 10,
    queueLimit        : 0,
});

db.getConnection((err, connection) => {
    if (err) console.error('❌ DB Error: ' + err.message);
    else { console.log('✅ MySQL Connected!'); connection.release(); }
});

// =============================================
// AUTH
// =============================================
app.post('/api/login', (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password)
        return res.status(400).json({ message: 'Email and password required' });

    db.query(
        'SELECT * FROM users WHERE email = ? AND password = ? AND is_active = 1',
        [email, password],
        (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            if (results.length > 0) res.json(results[0]);
            else res.status(401).json({ message: 'Wrong email or password' });
        }
    );
});

app.post('/api/register', (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password)
        return res.status(400).json({ message: 'Email and password required' });

    db.query('SELECT id FROM users WHERE email = ?', [email], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Server error' });
        if (rows.length > 0)
            return res.status(400).json({ message: 'Email already exists', emailExists: true });

        const colors = ['#10b981','#3b82f6','#8b5cf6','#f59e0b','#ef4444','#06b6d4'];
        const color = colors[Math.floor(Math.random() * colors.length)];

        db.query(
            'INSERT INTO users (email, password, avatar_color) VALUES (?, ?, ?)',
            [email, password, color],
            (err2, result) => {
                if (err2) return res.status(400).json({ message: 'Registration failed' });
                const uid = result.insertId;
                db.query('INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)',
                    [uid, 'Welcome to EcoServ! Schedule your first pickup to start earning eco points. 🌱', 'success']);
                db.query('INSERT INTO activity_log (user_id, action, points_earned) VALUES (?, ?, ?)',
                    [uid, 'Joined EcoServ', 10]);
                db.query('UPDATE users SET eco_points = 10 WHERE id = ?', [uid]);
                res.json({ id: uid, email, role: 'user', eco_points: 10, level: 1, avatar_color: color });
            }
        );
    });
});

// =============================================
// PROFILE
// =============================================
app.get('/api/profile/:id', (req, res) => {
    db.query(
        'SELECT id, email, full_name, phone, avatar_color, eco_points, level, role, created_at FROM users WHERE id = ?',
        [req.params.id],
        (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!results.length) return res.status(404).json({ message: 'Not found' });
            res.json(results[0]);
        }
    );
});

app.put('/api/profile/:id', (req, res) => {
    const { full_name, phone } = req.body || {};
    db.query(
        'UPDATE users SET full_name = ?, phone = ? WHERE id = ?',
        [full_name || null, phone || null, req.params.id],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Updated' });
        }
    );
});

// =============================================
// REQUESTS
// =============================================
app.get('/api/requests', (req, res) => {
    let sql, params;
    if (req.query.role === 'admin') {
        sql    = 'SELECT r.*, u.avatar_color FROM requests r LEFT JOIN users u ON r.user_id = u.id ORDER BY r.created_at DESC';
        params = [];
    } else if (req.query.role === 'collector') {
        sql    = 'SELECT * FROM requests WHERE collector_id = ? ORDER BY pickup_date ASC';
        params = [req.query.userId];
    } else {
        sql    = 'SELECT * FROM requests WHERE user_id = ? ORDER BY created_at DESC';
        params = [req.query.userId];
    }
    db.query(sql, params, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.post('/api/requests', (req, res) => {
    const d = req.body || {};
    db.query(
        'INSERT INTO requests (user_id, user_email, waste_type, weight, pickup_date, address, notes) VALUES (?,?,?,?,?,?,?)',
        [d.userId, d.userEmail, d.wasteType, d.weight, d.date, d.pickupAddress, d.notes || null],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            const points = Math.floor(d.weight * 5) + 10;
            db.query('UPDATE users SET eco_points = eco_points + ? WHERE id = ?', [points, d.userId]);
            db.query('INSERT INTO activity_log (user_id, action, points_earned) VALUES (?,?,?)',
                [d.userId, `Scheduled ${d.wasteType} pickup (${d.weight}kg)`, points]);
            db.query('INSERT INTO notifications (user_id, message, type) VALUES (?,?,?)',
                [d.userId, `✅ Pickup scheduled! You earned ${points} eco points.`, 'success']);
            updateUserLevel(d.userId);
            res.json({ message: 'Success', id: result.insertId, points_earned: points });
        }
    );
});

app.put('/api/requests/:id', (req, res) => {
    db.query('SELECT * FROM requests WHERE id = ?', [req.params.id], (err, rows) => {
        if (err || !rows.length) return res.status(404).json({ error: 'Not found' });
        const r = rows[0];
        const { status, collectorId, collectorName } = req.body || {};

        let sql, params;
        if (collectorId !== undefined) {
            sql    = "UPDATE requests SET collector_id = ?, collector_name = ?, status = 'Scheduled' WHERE id = ?";
            params = [collectorId || null, collectorName || null, req.params.id];
            if (collectorId && r.user_id) {
                db.query('INSERT INTO notifications (user_id, message, type) VALUES (?,?,?)',
                    [r.user_id, `📅 Your ${r.waste_type} pickup has been assigned to collector ${collectorName}. Status: Scheduled.`, 'update']);
                db.query('INSERT INTO notifications (user_id, message, type) VALUES (?,?,?)',
                    [collectorId, `🚚 New pickup assigned: ${r.waste_type} (${r.weight}kg) at ${r.address}. Date: ${r.pickup_date ? r.pickup_date.toString().split('T')[0] : ''}`, 'info']);
            }
        } else {
            sql    = 'UPDATE requests SET status = ? WHERE id = ?';
            params = [status, req.params.id];
            if (status === 'Recycled' && r.status !== 'Recycled' && r.user_id) {
                const bonus = r.weight * 10;
                db.query('UPDATE users SET eco_points = eco_points + ? WHERE id = ?', [bonus, r.user_id]);
                db.query('INSERT INTO notifications (user_id, message, type) VALUES (?,?,?)',
                    [r.user_id, `♻️ Your ${r.waste_type} has been recycled! Bonus: +${bonus} eco points!`, 'success']);
                updateUserLevel(r.user_id);
            } else if (status && status !== r.status && r.user_id) {
                db.query('INSERT INTO notifications (user_id, message, type) VALUES (?,?,?)',
                    [r.user_id, `📦 Your ${r.waste_type} pickup status updated to: ${status}`, 'update']);
            }
        }

        db.query(sql, params, (err2) => {
            if (err2) return res.status(500).json({ error: err2.message });
            res.json({ message: 'Updated' });
        });
    });
});

app.delete('/api/requests/:id', (req, res) => {
    db.query('DELETE FROM requests WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Deleted' });
    });
});

// =============================================
// ADMIN — USER MANAGEMENT
// =============================================
app.get('/api/admin/users', (req, res) => {
    db.query(`
        SELECT u.id, u.email, u.full_name, u.role, u.avatar_color, u.eco_points,
               u.level, u.is_active, u.created_at,
               COUNT(r.id) as total_requests
        FROM users u
        LEFT JOIN requests r ON u.id = r.user_id
        GROUP BY u.id
        ORDER BY u.created_at DESC
    `, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.put('/api/admin/users/:id', (req, res) => {
    const { role, is_active } = req.body || {};
    db.query('UPDATE users SET role = ?, is_active = ? WHERE id = ?',
        [role, is_active, req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'User updated' });
    });
});

app.delete('/api/admin/users/:id', (req, res) => {
    if (req.params.id == 1) return res.status(403).json({ message: 'Cannot delete admin' });
    db.query('DELETE FROM users WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Deleted' });
    });
});

app.get('/api/collectors', (req, res) => {
    db.query("SELECT id, email, full_name, avatar_color FROM users WHERE role = 'collector' AND is_active = 1",
        (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.get('/api/collector/stats/:id', (req, res) => {
    db.query(`
        SELECT
            COUNT(*) as total_assigned,
            SUM(CASE WHEN status = 'Scheduled'  THEN 1 ELSE 0 END) as pending_today,
            SUM(CASE WHEN status = 'Collected'  THEN 1 ELSE 0 END) as collected,
            SUM(CASE WHEN status = 'Recycled'   THEN 1 ELSE 0 END) as recycled,
            COALESCE(SUM(weight), 0) as total_kg
        FROM requests WHERE collector_id = ?
    `, [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results[0]);
    });
});

// =============================================
// NOTIFICATIONS
// =============================================
app.get('/api/notifications/:userId', (req, res) => {
    db.query('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
        [req.params.userId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.put('/api/notifications/read/:userId', (req, res) => {
    db.query('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [req.params.userId], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Marked as read' });
    });
});

// =============================================
// LEADERBOARD
// =============================================
app.get('/api/leaderboard', (req, res) => {
    db.query(`
        SELECT u.id, u.email, u.full_name, u.avatar_color, u.eco_points, u.level,
               COUNT(r.id) as total_requests,
               COALESCE(SUM(CASE WHEN r.status='Recycled' THEN r.weight ELSE 0 END),0) as total_recycled
        FROM users u LEFT JOIN requests r ON u.id = r.user_id
        WHERE u.role = 'user'
        GROUP BY u.id ORDER BY u.eco_points DESC LIMIT 10
    `, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// =============================================
// ANALYTICS
// =============================================
app.get('/api/analytics/:userId', (req, res) => {
    const userId  = req.params.userId;
    const isAdmin = req.query.role === 'admin';
    // Use parameterised queries — never interpolate userId directly
    const whereClause  = isAdmin ? '' : 'WHERE user_id = ?';
    const whereParams  = isAdmin ? [] : [userId];

    db.query(
        `SELECT DATE_FORMAT(created_at,'%b') as month, COUNT(*) as count, COALESCE(SUM(weight),0) as total_weight
         FROM requests ${whereClause}
         GROUP BY MONTH(created_at), DATE_FORMAT(created_at,'%b')
         ORDER BY MONTH(created_at) LIMIT 6`,
        whereParams,
        (err, monthly) => {
            if (err) return res.status(500).json({ error: err.message });
            db.query(
                `SELECT waste_type, COUNT(*) as count, SUM(weight) as total_weight
                 FROM requests ${whereClause} GROUP BY waste_type`,
                whereParams,
                (err2, byType) => {
                    if (err2) return res.status(500).json({ error: err2.message });
                    db.query(
                        `SELECT status, COUNT(*) as count FROM requests ${whereClause} GROUP BY status`,
                        whereParams,
                        (err3, byStatus) => {
                            if (err3) return res.status(500).json({ error: err3.message });
                            db.query(
                                `SELECT * FROM activity_log ${whereClause} ORDER BY created_at DESC LIMIT 10`,
                                whereParams,
                                (err4, activity) => {
                                    if (err4) return res.status(500).json({ error: err4.message });
                                    res.json({
                                        monthly : monthly  || [],
                                        byType  : byType   || [],
                                        byStatus: byStatus || [],
                                        activity: activity || [],
                                    });
                                }
                            );
                        }
                    );
                }
            );
        }
    );
});

// =============================================
// BADGES
// =============================================
app.get('/api/badges/:userId', (req, res) => {
    db.query('SELECT * FROM user_badges WHERE user_id = ? ORDER BY earned_at DESC',
        [req.params.userId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// =============================================
// AI — GROQ
// =============================================
async function callGroq(prompt) {
    if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY not configured');

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method : 'POST',
        headers: {
            'Content-Type' : 'application/json',
            'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
            model   : GROQ_MODEL,
            messages: [{ role: 'user', content: prompt }],
            max_tokens       : 256,
            temperature      : 0.7,
        }),
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Groq API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
}

app.post('/api/ai/sort', async (req, res) => {
    try {
        const { item } = req.body || {};
        if (!item) return res.status(400).json({ answer: 'Please provide an item.' });
        const answer = await callGroq(`In 1 short sentence, how to recycle or dispose of: ${item}`);
        res.json({ answer });
    } catch (err) {
        console.error('AI /sort error:', err.message);
        res.status(500).json({ answer: 'AI is temporarily unavailable. Please try again later.' });
    }
});

app.get('/api/ai/fact', async (req, res) => {
    try {
        const fact = await callGroq('Give one fascinating fun fact about recycling or the environment in one short sentence. No markdown, no bullet points.');
        res.json({ fact });
    } catch (err) {
        console.error('AI /fact error:', err.message);
        res.json({ fact: 'Recycling 1 ton of paper saves 17 trees and 7,000 gallons of water!' });
    }
});

app.post('/api/ai/impact', async (req, res) => {
    try {
        const { weight } = req.body || {};
        if (!weight) return res.status(400).json({ answer: 'Please provide weight.' });
        const answer = await callGroq(`User recycled ${weight}kg of waste. Tell them in 1 fun sentence what positive environmental impact they made (mention trees saved, CO2 reduced, or energy conserved).`);
        res.json({ answer });
    } catch (err) {
        console.error('AI /impact error:', err.message);
        res.status(500).json({ answer: 'AI is temporarily unavailable. Please try again later.' });
    }
});

app.post('/api/ai/chat', async (req, res) => {
    try {
        const { message, history } = req.body || {};
        if (!message) return res.status(400).json({ answer: 'Message is required.' });

        const messages = [
            {
                role: 'system',
                content: 'You are EcoBot, a friendly AI assistant for EcoServ waste management. Help with recycling tips, eco advice, and waste disposal. Keep responses concise (2-3 sentences). Be encouraging and use eco-themed emojis occasionally.'
            },
            ...(history || []).slice(-6).map(h => ({
                role: h.role === 'EcoBot' ? 'assistant' : 'user',
                content: h.content
            })),
            { role: 'user', content: message }
        ];

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`,
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages: messages,
                max_tokens: 256,
                temperature: 0.7,
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Groq API error ${response.status}: ${errText}`);
        }

        const data = await response.json();
        const answer = data.choices[0].message.content.trim();
        res.json({ answer });
    } catch (err) {
        console.error('AI /chat error:', err.message);
        res.status(500).json({ answer: "I'm having trouble connecting right now. Please try again shortly!" });
    }
});

app.post('/api/ai/schedule', async (req, res) => {
    try {
        const { wasteType, weight } = req.body || {};
        if (!wasteType || !weight) return res.status(400).json({ suggestion: 'Please provide waste type and weight.' });
        const suggestion = await callGroq(`For ${weight}kg of ${wasteType} waste, suggest the best day and time for pickup, plus one preparation tip, in 2 sentences.`);
        res.json({ suggestion });
    } catch (err) {
        console.error('AI /schedule error:', err.message);
        res.status(500).json({ suggestion: 'Weekday mornings are best for pickup. Ensure waste is properly sorted and bagged before collection.' });
    }
});

// =============================================
// HELPERS
// =============================================
function updateUserLevel(userId) {
    db.query('SELECT eco_points FROM users WHERE id = ?', [userId], (err, rows) => {
        if (err || !rows.length) return;
        const pts   = rows[0].eco_points;
        const level = Math.min(Math.floor(pts / 200) + 1, 10);
        db.query('UPDATE users SET level = ? WHERE id = ?', [level, userId]);
        checkAndAwardBadges(userId, pts);
    });
}

function checkAndAwardBadges(userId, points) {
    const badges = [
        { threshold:   50, name: 'First Steps',    icon: '🌱' },
        { threshold:  200, name: 'Eco Starter',    icon: '♻️' },
        { threshold:  500, name: 'Green Guardian', icon: '🌿' },
        { threshold: 1000, name: 'Eco Warrior',    icon: '🌍' },
        { threshold: 2000, name: 'Planet Saver',   icon: '🏆' },
    ];
    badges.forEach(b => {
        if (points >= b.threshold) {
            db.query('SELECT id FROM user_badges WHERE user_id = ? AND badge_name = ?', [userId, b.name], (err, rows) => {
                if (!err && !rows.length) {
                    db.query('INSERT INTO user_badges (user_id, badge_name, badge_icon) VALUES (?,?,?)', [userId, b.name, b.icon]);
                    db.query('INSERT INTO notifications (user_id, message, type) VALUES (?,?,?)',
                        [userId, `${b.icon} New badge earned: "${b.name}"! Keep it up!`, 'success']);
                }
            });
        }
    });
}

// =============================================
// START
// =============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
});
