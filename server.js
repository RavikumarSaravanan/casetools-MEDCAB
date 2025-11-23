const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const saltRounds = 10;
// Try to load dotenv, but continue if not available
let dotenvLoaded = false;
try {
  require('dotenv').config();
  dotenvLoaded = true;
  console.log('Environment variables loaded successfully');
} catch (error) {
  console.log('dotenv module not found, continuing without environment variables');
}

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname)); // Serve static files from current directory

// MongoDB connection
// ... existing code ...
// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ambulanceBooking';
console.log('Attempting to connect to MongoDB with URI:', MONGODB_URI);

// Parse and construct the MongoDB URI properly
let finalUri = MONGODB_URI;
if (MONGODB_URI.includes('mongodb+srv')) {
  // For MongoDB Atlas, ensure proper database specification
  try {
    const url = new URL(MONGODB_URI);
    if (!url.pathname || url.pathname === '/') {
      url.pathname = '/ambulanceBooking';
      finalUri = url.toString();
    }
    // Remove any duplicate slashes that might have been introduced
    finalUri = finalUri.replace(/\/+/g, '/').replace(':/', '://');
  } catch (parseError) {
    // Fallback if URL parsing fails
    if (!MONGODB_URI.includes('ambulanceBooking')) {
      const queryStart = MONGODB_URI.indexOf('?');
      if (queryStart !== -1) {
        finalUri = `${MONGODB_URI.substring(0, queryStart)}/ambulanceBooking${MONGODB_URI.substring(queryStart)}`;
      } else {
        finalUri = `${MONGODB_URI}/ambulanceBooking`;
      }
    }
  }
}

console.log('Final MongoDB URI:', finalUri);
// ... existing code ...
mongoose.connect(finalUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on('error', (err) => {
  console.error('MongoDB connection error:', err);
  console.error('Please check if:');
  console.error('1. Your MongoDB Atlas credentials are correct');
  console.error('2. You have network connectivity');
  console.error('3. Your IP address is whitelisted in MongoDB Atlas');
});
db.once('open', async () => {
  console.log('Successfully connected to MongoDB');
  console.log('Database URI:', finalUri);
  
  // Create collections explicitly if they don't exist
  try {
    await User.createCollection();
    console.log('Users collection is ready');
    
    await Driver.createCollection();
    console.log('Drivers collection is ready');
    
    await Booking.createCollection();
    console.log('Bookings collection is ready');
    
    await Payment.createCollection();
    console.log('Payments collection is ready');
  } catch (err) {
    console.log('Collections already exist or error creating them:', err.message);
  }
});

// Add connection event listeners for better debugging
db.on('connected', () => {
  console.log('Mongoose connected to MongoDB');
});

db.on('disconnected', () => {
  console.log('Mongoose disconnected from MongoDB');
});

// Schemas and Models
const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  username: { type: String, unique: true },
  email: { type: String, unique: true },
  mobile: String,
  gender: String,
  createdAt: { type: Date, default: Date.now }
});

const driverSchema = new mongoose.Schema({
  name: String,
  vehicleNumber: String,
  contact: String,
  password : String,
  available: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const bookingSchema = new mongoose.Schema({
  patientName: String,
  contactNumber: String,
  pickupAddress: String,
  bookingDateTime: Date,
  ambulanceType: String,
  status: { type: String, default: 'pending' }, // pending, confirmed, completed
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

const paymentSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  fullName: String,
  email: String,
  address: String,
  city: String,
  state: String,
  zipCode: String,
  cardName: String,
  cardNumber: String,
  expMonth: String,
  expYear: String,
  cvv: String,
  amount: Number,
  paidAt: { type: Date, default: Date.now }
});
const locationSchema = new mongoose.Schema({
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver' },
  latitude: Number,
  longitude: Number,
  timestamp: { type: Date, default: Date.now },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }
});
const User = mongoose.model('User', userSchema);
const Driver = mongoose.model('Driver', driverSchema);
const Booking = mongoose.model('Booking', bookingSchema);
const Payment = mongoose.model('Payment', paymentSchema);
const Location = mongoose.model('Location', locationSchema);

// Routes

// Update driver location (for real-time GPS tracking)
app.post('/api/update-location', async (req, res) => {
  try {
    console.log('Location update request received:', req.body);
    const { driverId, latitude, longitude, bookingId } = req.body;
    
    const location = new Location({
      driverId,
      latitude,
      longitude,
      bookingId
    });
    
    await location.save();
    console.log('Location updated for driver:', driverId);
    
    res.status(201).json({ 
      success: true, 
      message: 'Location updated successfully',
      location 
    });
  } catch (error) {
    console.error('Location update error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get driver's current location
app.get('/api/driver-location/:driverId', async (req, res) => {
  try {
    console.log('Fetching location for driver:', req.params.driverId);
    
    const location = await Location
      .findOne({ driverId: req.params.driverId })
      .sort({ timestamp: -1 });
    
    if (location) {
      console.log('Location found for driver:', req.params.driverId);
      res.json({ success: true, location });
    } else {
      console.log('No location found for driver:', req.params.driverId);
      res.status(404).json({ success: false, message: 'Location not found' });
    }
  } catch (error) {
    console.error('Error fetching location:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all locations for a booking (route history)
app.get('/api/booking-locations/:bookingId', async (req, res) => {
  try {
    console.log('Fetching locations for booking:', req.params.bookingId);
    
    const locations = await Location
      .find({ bookingId: req.params.bookingId })
      .sort({ timestamp: 1 });
    
    console.log('Found', locations.length, 'locations for booking:', req.params.bookingId);
    res.json({ success: true, locations });
  } catch (error) {
    console.error('Error fetching booking locations:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update booking status
app.put('/api/booking/:id/status', async (req, res) => {
  try {
    console.log('Updating booking status:', req.params.id, req.body);
    const { status } = req.body;
    
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('driverId');
    
    if (booking) {
      console.log('Booking status updated:', booking._id, status);
      res.json({ 
        success: true, 
        message: 'Booking status updated',
        booking 
      });
    } else {
      console.log('Booking not found:', req.params.id);
      res.status(404).json({ success: false, message: 'Booking not found' });
    }
  } catch (error) {
    console.error('Error updating booking status:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all bookings for a user
app.get('/api/user-bookings/:userId', async (req, res) => {
  try {
    console.log('Fetching bookings for user:', req.params.userId);
    
    const bookings = await Booking
      .find({ userId: req.params.userId })
      .populate('driverId')
      .sort({ createdAt: -1 });
    
    console.log('Found', bookings.length, 'bookings for user:', req.params.userId);
    res.json({ success: true, bookings });
  } catch (error) {
    console.error('Error fetching user bookings:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all active bookings (for dashboard)
app.get('/api/active-bookings', async (req, res) => {
  try {
    console.log('Fetching active bookings');
    
    const bookings = await Booking
      .find({ status: { $in: ['pending', 'confirmed'] } })
      .populate('driverId')
      .populate('userId')
      .sort({ createdAt: -1 });
    
    console.log('Found', bookings.length, 'active bookings');
    res.json({ success: true, bookings });
  } catch (error) {
    console.error('Error fetching active bookings:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Assign driver to booking
app.put('/api/booking/:id/assign-driver', async (req, res) => {
  try {
    console.log('Assigning driver to booking:', req.params.id, req.body);
    const { driverId } = req.body;
    
    // Update booking with driver
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { 
        driverId,
        status: 'confirmed'
      },
      { new: true }
    ).populate('driverId');
    
    // Mark driver as unavailable
    if (driverId) {
      await Driver.findByIdAndUpdate(driverId, { available: false });
      console.log('Driver marked as unavailable:', driverId);
    }
    
    if (booking) {
      console.log('Driver assigned to booking:', booking._id);
      res.json({ 
        success: true, 
        message: 'Driver assigned successfully',
        booking 
      });
    } else {
      console.log('Booking not found:', req.params.id);
      res.status(404).json({ success: false, message: 'Booking not found' });
    }
  } catch (error) {
    console.error('Error assigning driver:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Complete booking
app.put('/api/booking/:id/complete', async (req, res) => {
  try {
    console.log('Completing booking:', req.params.id);
    
    // Update booking status
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status: 'completed' },
      { new: true }
    ).populate('driverId');
    
    // Mark driver as available
    if (booking && booking.driverId) {
      await Driver.findByIdAndUpdate(booking.driverId, { available: true });
      console.log('Driver marked as available:', booking.driverId);
    }
    
    if (booking) {
      console.log('Booking completed:', booking._id);
      res.json({ 
        success: true, 
        message: 'Booking completed successfully',
        booking 
      });
    } else {
      console.log('Booking not found:', req.params.id);
      res.status(404).json({ success: false, message: 'Booking not found' });
    }
  } catch (error) {
    console.error('Error completing booking:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});
// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});
// ... existing code ...
// Add these new routes after your existing routes

// Register new driver
app.post('/api/register-driver', async (req, res) => {
  try {
    console.log('Driver registration request received:', req.body);
    const { name, vehicleNumber, contact, password } = req.body;
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Create new driver
    const driver = new Driver({ 
      name, 
      vehicleNumber, 
      contact, 
      password: hashedPassword 
    });
    
    await driver.save();
    console.log('Driver registered successfully with ID:', driver._id);
    
    res.status(201).json({ 
      success: true, 
      message: 'Driver registered successfully', 
      driver: {
        id: driver._id,
        name: driver.name,
        vehicleNumber: driver.vehicleNumber,
        contact: driver.contact
      } 
    });
  } catch (error) {
    console.error('Driver registration error:', error);
    if (error.code === 11000) {
      res.status(400).json({ success: false, message: 'Driver already exists' });
    } else {
      res.status(500).json({ success: false, message: error.message });
    }
  }
});

// Driver login
app.post('/api/driver-login', async (req, res) => {
  try {
    console.log('Driver login request received:', req.body);
    const { driverId, password } = req.body;
    
    // Find driver by ID
    const driver = await Driver.findById(driverId);
    
    if (driver) {
      // Compare passwords
      const isPasswordValid = await bcrypt.compare(password, driver.password);
      
      if (isPasswordValid) {
        console.log('Driver login successful for:', driver.name);
        res.json({ 
          success: true, 
          message: 'Login successful', 
          driver: {
            id: driver._id,
            name: driver.name,
            vehicleNumber: driver.vehicleNumber,
            contact: driver.contact
          } 
        });
      } else {
        console.log('Invalid password for driver:', driverId);
        res.status(401).json({ success: false, message: 'Invalid credentials' });
      }
    } else {
      console.log('Driver not found with ID:', driverId);
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Driver login error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get all drivers (without passwords)
app.get('/api/drivers', async (req, res) => {
  try {
    // Exclude password field from results
    const drivers = await Driver.find({}, { password: 0 });
    res.json({ success: true, drivers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
// ... existing code ...
// User registration
app.post('/api/register', async (req, res) => {
  try {
    console.log('Registration request received:', req.body);
    const { firstName, lastName, username, email, mobile, gender } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ username: username }, { email: email }] 
    });
    
    if (existingUser) {
      console.log('User already exists with username or email:', username, email);
      return res.status(400).json({ 
        success: false, 
        message: 'Username or email already exists' 
      });
    }
    
    const user = new User({ firstName, lastName, username, email, mobile, gender });
    console.log('Creating new user:', user);
    
    await user.save();
    console.log('User registered successfully with ID:', user._id);
    
    res.status(201).json({ 
      success: true, 
      message: 'User registered successfully', 
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        email: user.email
      } 
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      res.status(400).json({ success: false, message: messages.join(', ') });
    } else if (error.code === 11000) {
      res.status(400).json({ success: false, message: 'Username or email already exists' });
    } else {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
});


// // User login (simplified)
// app.post('/api/login', async (req, res) => {
//   try {
//     console.log('Login request received:', req.body);
//     const { username, email } = req.body;
    
//     // Try to find user by username or email
//     let user = null;
//     if (username) {
//       user = await User.findOne({ username: username });
//     }
    
//     if (!user && email) {
//       user = await User.findOne({ email: email });
//     }
    
//     if (user) {
//       console.log('Login successful for user:', user.username);
//       res.json({ 
//         success: true, 
//         message: 'Login successful', 
//         user: {
//           id: user._id,
//           firstName: user.firstName,
//           lastName: user.lastName,
//           username: user.username,
//           email: user.email
//         } 
//       });
//     } else {
//       console.log('Login failed for:', username || email);
//       res.status(401).json({ success: false, message: 'Invalid credentials' });
//     }
//   } catch (error) {
//     console.error('Login error:', error);
//     res.status(500).json({ success: false, message: error.message });
//   }
// });

// ... existing code ...
// User login (enhanced)
app.post('/api/login', async (req, res) => {
  try {
    console.log('Login request received:', req.body);
    const { username, email } = req.body;
    
    let user = null;
    const searchCriteria = [];
    
    // Build search criteria
    if (username) {
      searchCriteria.push({ username: username });
    }
    
    if (email) {
      searchCriteria.push({ email: email });
    }
    
    // Search for user with any of the provided criteria
    if (searchCriteria.length > 0) {
      user = await User.findOne({ 
        $or: searchCriteria 
      });
    }
    
    console.log('Search criteria:', searchCriteria);
    console.log('Found user:', user ? user.username : 'Not found');
    
    if (user) {
      console.log('Login successful for user:', user.username);
      res.json({ 
        success: true, 
        message: 'Login successful', 
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          email: user.email
        } 
      });
    } else {
      console.log('Login failed. No user found with criteria:', searchCriteria);
      res.status(401).json({ success: false, message: 'Invalid credentials. Please check your username and email.' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Internal server error. Please try again later.' });
  }
});
// ... existing code ...
// Book ambulance
app.post('/api/book-ambulance', async (req, res) => {
  try {
    console.log('Booking request received:', req.body);
    const { patientName, contactNumber, pickupAddress, bookingDateTime, ambulanceType } = req.body;
    
    // Find an available driver (simplified logic)
    const driver = await Driver.findOne({ available: true });
    console.log('Found available driver:', driver ? driver.name : 'None');
    
    const booking = new Booking({
      patientName,
      contactNumber,
      pickupAddress,
      bookingDateTime,
      ambulanceType,
      driverId: driver ? driver._id : null
    });
    
    await booking.save();
    console.log('Booking saved with ID:', booking._id);
    
    // Update driver availability
    if (driver) {
      driver.available = false;
      await driver.save();
      console.log('Driver marked as unavailable:', driver.name);
    }
    
    res.status(201).json({
      success: true,
      message: 'Booking successful!',
      bookingId: booking._id,
      driver: driver ? {
        name: driver.name,
        vehicleNumber: driver.vehicleNumber,
        contact: driver.contact
      } : null
    });
  } catch (error) {
    console.error('Booking error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get booking by ID
app.get('/api/booking/:id', async (req, res) => {
  try {
    console.log('Fetching booking with ID:', req.params.id);
    const booking = await Booking.findById(req.params.id).populate('driverId');
    if (booking) {
      console.log('Booking found:', booking._id);
      res.json({ success: true, booking });
    } else {
      console.log('Booking not found with ID:', req.params.id);
      res.status(404).json({ success: false, message: 'Booking not found' });
    }
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Process payment
app.post('/api/payment', async (req, res) => {
  try {
    console.log('Payment request received:', req.body);
    const paymentData = req.body;
    const payment = new Payment(paymentData);
    await payment.save();
    console.log('Payment processed with ID:', payment._id);
    res.status(201).json({ success: true, message: 'Payment processed successfully', paymentId: payment._id });
  } catch (error) {
    console.error('Payment error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Add sample drivers
app.post('/api/setup-drivers', async (req, res) => {
  try {
    console.log('Setting up sample drivers');
    const drivers = [
      { name: 'John Raj', vehicleNumber: 'TN 05 AB 1234', contact: '+91 9876543210' },
      { name: 'Kumar Selvaraj', vehicleNumber: 'TN 05 CD 5678', contact: '+91 9876543211' },
      { name: 'Ravi Shankar', vehicleNumber: 'TN 05 EF 9012', contact: '+91 9876543212' }
    ];
    
    // Clear existing drivers first
    await Driver.deleteMany({});
    console.log('Cleared existing drivers');
    
    await Driver.insertMany(drivers);
    console.log('Drivers added successfully');
    res.json({ success: true, message: 'Drivers added successfully' });
  } catch (error) {
    console.error('Error setting up drivers:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all drivers (for testing)
app.get('/api/drivers', async (req, res) => {
  try {
    const drivers = await Driver.find();
    res.json({ success: true, drivers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Serve HTML files
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/home.html');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`MongoDB connection string: ${finalUri}`);
});