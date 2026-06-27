// server/index.js (Production Ready - Local + Vercel)
const express = require('express');
const app = express();
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

// ✅ Stripe
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// ✅ CORS - Production Ready
app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://localhost:5000',
        'https://rentnest-client.vercel.app',
        'https://rent-nest-client.vercel.app',
        process.env.FRONTEND_URL,
        process.env.BETTER_AUTH_URL
    ].filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// ✅ Health Check
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: '🚀 RentNest API is running!',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

const uri = process.env.MONGODB_URI;
if (!uri) {
    throw new Error('MONGODB_URI is not defined');
}

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: false,
        deprecationErrors: true,
    }
});

let db;
let propertiesCollection;
let usersCollection;
let favoritesCollection;
let bookingsCollection;
let reviewsCollection;

// ✅ Database Connection
async function connectDB() {
    try {
        if (client && db) {
            console.log('✅ Using existing database connection');
            return;
        }

        await client.connect();
        db = client.db('RentNest');
        propertiesCollection = db.collection('properties');
        usersCollection = db.collection('user');
        favoritesCollection = db.collection('favorites');
        bookingsCollection = db.collection('bookings');
        reviewsCollection = db.collection('reviews');

        await client.db("admin").command({ ping: 1 });
        console.log('✅ MongoDB connected successfully!');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        throw error;
    }
}

// Connect on startup
connectDB().catch(console.error);

// ============================================================
// ==================== USER APIS ==============================
// ============================================================

app.get('/api/user', async (req, res) => {
    try {
        await connectDB();
        const user = await usersCollection.find().toArray();
        res.json({ success: true, user });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch users' });
    }
});

app.get('/api/user/:id', async (req, res) => {
    try {
        await connectDB();
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid user ID' });
        }
        const user = await usersCollection.findOne({ _id: new ObjectId(id) });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.json({ success: true, user });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch user' });
    }
});

app.post('/api/user', async (req, res) => {
    try {
        await connectDB();
        const user = req.body;
        const result = await usersCollection.insertOne(user);
        res.status(201).json({
            success: true,
            message: 'User created successfully',
            user: { ...user, _id: result.insertedId }
        });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ success: false, message: 'Failed to create user' });
    }
});

app.patch('/api/user/:id', async (req, res) => {
    try {
        await connectDB();
        const { id } = req.params;
        const { role } = req.body;
        const validRoles = ['tenant', 'owner', 'admin'];
        if (!role || !validRoles.includes(role.toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: `Invalid role. Must be one of: ${validRoles.join(', ')}`
            });
        }
        const result = await usersCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { role: role.toLowerCase(), updatedAt: new Date() } }
        );
        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const updatedUser = await usersCollection.findOne({ _id: new ObjectId(id) });
        res.json({ success: true, message: `User role updated to ${role}`, user: updatedUser });
    } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({ success: false, message: 'Failed to update user role' });
    }
});

app.patch('/api/user/profile/:id', async (req, res) => {
    try {
        await connectDB();
        const { id } = req.params;
        const updateData = req.body;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid user ID' });
        }
        delete updateData._id;
        delete updateData.password;
        const result = await usersCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { ...updateData, updatedAt: new Date() } }
        );
        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const updatedUser = await usersCollection.findOne({ _id: new ObjectId(id) });
        res.json({ success: true, message: 'Profile updated successfully', user: updatedUser });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ success: false, message: 'Failed to update profile' });
    }
});

app.delete('/api/user/:id', async (req, res) => {
    try {
        await connectDB();
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid user ID' });
        }
        const result = await usersCollection.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ success: false, message: 'Failed to delete user' });
    }
});

// ============================================================
// ==================== PROPERTIES APIS ========================
// ============================================================

app.post('/api/properties', async (req, res) => {
    try {
        await connectDB();
        const property = req.body;
        property.createdAt = new Date();
        property.updatedAt = new Date();
        property.status = property.status || 'pending';
        const result = await propertiesCollection.insertOne(property);
        res.status(201).json({
            success: true,
            message: 'Property created successfully',
            property: { ...property, _id: result.insertedId }
        });
    } catch (error) {
        console.error('Error creating property:', error);
        res.status(500).json({ success: false, message: 'Failed to create property' });
    }
});

app.get('/api/properties', async (req, res) => {
    try {
        await connectDB();
        const {
            search,
            location,
            propertyType,
            minPrice,
            maxPrice,
            bedrooms,
            bathrooms,
            sortBy,
            sortOrder,
            status,
            isAdmin,
            isOwner,
            ownerId,
            page = 1,
            limit = 50  // ✅ 20 → 50 করে দিলাম
        } = req.query;

        let query = {};

        if (isAdmin === 'true') {
            if (status && status !== 'all') {
                query.status = status;
            }
        } else if (isOwner === 'true' && ownerId) {
            query.$or = [{ 'ownerId': ownerId }, { 'owner.id': ownerId }];
            if (status && status !== 'all') {
                query.status = status;
            }
        } else {
            query.status = 'approved';
        }

        if (search) {
            const searchRegex = { $regex: search, $options: 'i' };
            query.$or = query.$or || [];
            query.$or.push(
                { title: searchRegex },
                { description: searchRegex },
                { location: searchRegex },
                { 'address.city': searchRegex },
                { 'address.state': searchRegex },
                { 'address.zipCode': searchRegex },
                { 'address.fullAddress': searchRegex }
            );
        }

        if (location) {
            const locationRegex = { $regex: location, $options: 'i' };
            if (query.$or) {
                query.$or.push(
                    { location: locationRegex },
                    { 'address.city': locationRegex },
                    { 'address.state': locationRegex },
                    { 'address.zipCode': locationRegex },
                    { 'address.fullAddress': locationRegex }
                );
            } else {
                query.$or = [
                    { location: locationRegex },
                    { 'address.city': locationRegex },
                    { 'address.state': locationRegex },
                    { 'address.zipCode': locationRegex },
                    { 'address.fullAddress': locationRegex }
                ];
            }
        }

        if (propertyType) {
            query.propertyType = { $regex: `^${propertyType}$`, $options: 'i' };
        }

        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = parseFloat(minPrice);
            if (maxPrice) query.price.$lte = parseFloat(maxPrice);
        }

        if (bedrooms) {
            query['specifications.bedrooms'] = { $gte: parseInt(bedrooms) };
        }

        if (bathrooms) {
            query['specifications.bathrooms'] = { $gte: parseInt(bathrooms) };
        }

        let sort = {};
        const sortField = sortBy || 'createdAt';
        const sortDirection = sortOrder === 'asc' ? 1 : -1;

        switch (sortField) {
            case 'price':
                sort.price = 1;
                break;
            case 'priceDesc':
                sort.price = -1;
                break;
            case 'title':
                sort.title = 1;
                break;
            case 'bedrooms':
                sort['specifications.bedrooms'] = -1;
                break;
            default:
                sort.createdAt = sortDirection;
                break;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const limitNum = parseInt(limit);

        const totalCount = await propertiesCollection.countDocuments(query);
        const properties = await propertiesCollection
            .find(query)
            .sort(sort)
            .skip(skip)
            .limit(limitNum)
            .toArray();

        res.json({
            success: true,
            properties,
            count: properties.length,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limitNum),
                totalItems: totalCount,
                itemsPerPage: limitNum
            },
            filters: {
                search: search || null,
                location: location || null,
                propertyType: propertyType || null,
                minPrice: minPrice || null,
                maxPrice: maxPrice || null,
                bedrooms: bedrooms || null,
                bathrooms: bathrooms || null,
                sortBy: sortField,
                sortOrder: sortOrder || 'desc',
                isAdmin: isAdmin || false,
                isOwner: isOwner || false
            }
        });
    } catch (error) {
        console.error('❌ Error fetching properties:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch properties', error: error.message });
    }
});

// ✅ GET - All properties (No pagination limit) - Admin/Owner এর জন্য
app.get('/api/properties/all', async (req, res) => {
    try {
        await connectDB();
        const {
            search,
            location,
            propertyType,
            minPrice,
            maxPrice,
            bedrooms,
            bathrooms,
            sortBy,
            sortOrder,
            status,
            isAdmin,
            isOwner,
            ownerId
        } = req.query;

        let query = {};

        if (isAdmin === 'true') {
            if (status && status !== 'all') {
                query.status = status;
            }
        } else if (isOwner === 'true' && ownerId) {
            query.$or = [{ 'ownerId': ownerId }, { 'owner.id': ownerId }];
            if (status && status !== 'all') {
                query.status = status;
            }
        } else {
            query.status = 'approved';
        }

        if (search) {
            const searchRegex = { $regex: search, $options: 'i' };
            query.$or = query.$or || [];
            query.$or.push(
                { title: searchRegex },
                { description: searchRegex },
                { location: searchRegex },
                { 'address.city': searchRegex },
                { 'address.state': searchRegex },
                { 'address.zipCode': searchRegex },
                { 'address.fullAddress': searchRegex }
            );
        }

        if (location) {
            const locationRegex = { $regex: location, $options: 'i' };
            if (query.$or) {
                query.$or.push(
                    { location: locationRegex },
                    { 'address.city': locationRegex },
                    { 'address.state': locationRegex },
                    { 'address.zipCode': locationRegex },
                    { 'address.fullAddress': locationRegex }
                );
            } else {
                query.$or = [
                    { location: locationRegex },
                    { 'address.city': locationRegex },
                    { 'address.state': locationRegex },
                    { 'address.zipCode': locationRegex },
                    { 'address.fullAddress': locationRegex }
                ];
            }
        }

        if (propertyType) {
            query.propertyType = { $regex: `^${propertyType}$`, $options: 'i' };
        }

        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = parseFloat(minPrice);
            if (maxPrice) query.price.$lte = parseFloat(maxPrice);
        }

        if (bedrooms) {
            query['specifications.bedrooms'] = { $gte: parseInt(bedrooms) };
        }

        if (bathrooms) {
            query['specifications.bathrooms'] = { $gte: parseInt(bathrooms) };
        }

        let sort = {};
        const sortField = sortBy || 'createdAt';
        const sortDirection = sortOrder === 'asc' ? 1 : -1;

        switch (sortField) {
            case 'price':
                sort.price = 1;
                break;
            case 'priceDesc':
                sort.price = -1;
                break;
            case 'title':
                sort.title = 1;
                break;
            case 'bedrooms':
                sort['specifications.bedrooms'] = -1;
                break;
            default:
                sort.createdAt = sortDirection;
                break;
        }

        const properties = await propertiesCollection
            .find(query)
            .sort(sort)
            .toArray();

        res.json({
            success: true,
            properties,
            count: properties.length
        });
    } catch (error) {
        console.error('Error fetching all properties:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch properties', error: error.message });
    }
});

app.get('/api/properties/types', async (req, res) => {
    try {
        await connectDB();
        const types = await propertiesCollection.aggregate([
            { $match: { status: 'approved' } },
            { $group: { _id: '$propertyType', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]).toArray();
        res.json({
            success: true,
            types: types.map(t => ({ type: t._id || 'Unknown', count: t.count }))
        });
    } catch (error) {
        console.error('Error fetching property types:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch property types' });
    }
});

app.get('/api/properties/locations', async (req, res) => {
    try {
        await connectDB();
        const locations = await propertiesCollection.aggregate([
            { $match: { status: 'approved' } },
            { $group: { _id: '$location', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 20 }
        ]).toArray();
        res.json({
            success: true,
            locations: locations.map(l => ({ location: l._id || 'Unknown', count: l.count }))
        });
    } catch (error) {
        console.error('Error fetching locations:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch locations' });
    }
});

app.get('/api/properties/price-stats', async (req, res) => {
    try {
        await connectDB();
        const stats = await propertiesCollection.aggregate([
            { $match: { status: 'approved' } },
            { $group: { _id: null, minPrice: { $min: '$price' }, maxPrice: { $max: '$price' }, avgPrice: { $avg: '$price' } } }
        ]).toArray();
        const result = stats[0] || { minPrice: 0, maxPrice: 1000000, avgPrice: 0 };
        res.json({
            success: true,
            stats: {
                minPrice: result.minPrice || 0,
                maxPrice: result.maxPrice || 1000000,
                avgPrice: Math.round(result.avgPrice || 0)
            }
        });
    } catch (error) {
        console.error('Error fetching price stats:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch price stats' });
    }
});

app.get('/api/properties/suggestions', async (req, res) => {
    try {
        await connectDB();
        const { q, limit = 10 } = req.query;
        if (!q || q.length < 2) {
            return res.json({ success: true, suggestions: [] });
        }
        const regex = { $regex: q, $options: 'i' };
        const suggestions = await propertiesCollection.aggregate([
            { $match: { status: 'approved', $or: [{ title: regex }, { location: regex }, { 'address.city': regex }, { 'address.state': regex }] } },
            { $project: { title: 1, location: 1, city: '$address.city', state: '$address.state' } },
            { $limit: parseInt(limit) }
        ]).toArray();
        res.json({
            success: true,
            suggestions: suggestions.map(s => ({ title: s.title, location: s.location || s.city || s.state || '' }))
        });
    } catch (error) {
        console.error('Error fetching suggestions:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch suggestions' });
    }
});

app.get('/api/properties/featured', async (req, res) => {
    try {
        await connectDB();
        const properties = await propertiesCollection
            .find({ status: 'approved' })
            .limit(6)
            .sort({ createdAt: -1 })
            .toArray();
        res.json({ success: true, properties, count: properties.length });
    } catch (error) {
        console.error('Error fetching featured properties:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch featured properties' });
    }
});

app.get("/api/properties/user/:id", async (req, res) => {
    try {
        await connectDB();
        const userId = req.params.id;
        const properties = await propertiesCollection
            .find({ $or: [{ 'ownerId': userId }, { 'owner.id': userId }] })
            .sort({ createdAt: -1 })
            .toArray();
        res.json({ success: true, properties, count: properties.length });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to fetch user properties" });
    }
});

app.get('/api/properties/:id', async (req, res) => {
    try {
        await connectDB();
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid property ID' });
        }
        const property = await propertiesCollection.findOne({ _id: new ObjectId(id) });
        if (!property) {
            return res.status(404).json({ success: false, message: 'Property not found' });
        }
        res.json(property);
    } catch (error) {
        console.error('Error fetching property:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch property' });
    }
});

app.patch('/api/properties/:id/approve', async (req, res) => {
    try {
        await connectDB();
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid property ID' });
        }
        const result = await propertiesCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { status: 'approved', approvedAt: new Date(), updatedAt: new Date() } }
        );
        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, message: 'Property not found' });
        }
        const updatedProperty = await propertiesCollection.findOne({ _id: new ObjectId(id) });
        res.json({ success: true, message: 'Property approved successfully', property: updatedProperty });
    } catch (error) {
        console.error('Error approving property:', error);
        res.status(500).json({ success: false, message: 'Failed to approve property' });
    }
});

app.patch('/api/properties/:id/reject', async (req, res) => {
    try {
        await connectDB();
        const { id } = req.params;
        const { rejectionReason } = req.body;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid property ID' });
        }
        const result = await propertiesCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { status: 'rejected', rejectionReason: rejectionReason || 'No reason provided', rejectedAt: new Date(), updatedAt: new Date() } }
        );
        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, message: 'Property not found' });
        }
        const updatedProperty = await propertiesCollection.findOne({ _id: new ObjectId(id) });
        res.json({ success: true, message: 'Property rejected successfully', property: updatedProperty });
    } catch (error) {
        console.error('Error rejecting property:', error);
        res.status(500).json({ success: false, message: 'Failed to reject property' });
    }
});

app.patch('/api/properties/:id', async (req, res) => {
    try {
        await connectDB();
        const { id } = req.params;
        const updateData = req.body;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid property ID' });
        }
        delete updateData._id;
        delete updateData.createdAt;
        const result = await propertiesCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { ...updateData, updatedAt: new Date() } }
        );
        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, message: 'Property not found' });
        }
        const updatedProperty = await propertiesCollection.findOne({ _id: new ObjectId(id) });
        res.json({ success: true, message: 'Property updated successfully', property: updatedProperty });
    } catch (error) {
        console.error('Error updating property:', error);
        res.status(500).json({ success: false, message: 'Failed to update property' });
    }
});

app.delete('/api/properties/:id', async (req, res) => {
    try {
        await connectDB();
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid property ID' });
        }
        const result = await propertiesCollection.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) {
            return res.status(404).json({ success: false, message: 'Property not found' });
        }
        res.json({ success: true, message: 'Property deleted successfully' });
    } catch (error) {
        console.error('Error deleting property:', error);
        res.status(500).json({ success: false, message: 'Failed to delete property' });
    }
});

// ============================================================
// ==================== FAVORITES APIS =========================
// ============================================================

app.post('/api/favorites', async (req, res) => {
    try {
        await connectDB();
        const { tenantId, propertyId, propertyData } = req.body;
        if (!tenantId || !propertyId) {
            return res.status(400).json({ success: false, message: 'tenantId and propertyId are required' });
        }
        const existingFavorite = await favoritesCollection.findOne({ tenantId, propertyId });
        if (existingFavorite) {
            return res.status(400).json({ success: false, message: 'Property already in favorites' });
        }
        const favorite = { tenantId, propertyId, propertyData: propertyData || null, createdAt: new Date() };
        const result = await favoritesCollection.insertOne(favorite);
        res.status(201).json({ success: true, message: 'Property added to favorites', favorite: { ...favorite, _id: result.insertedId } });
    } catch (error) {
        console.error('Error adding favorite:', error);
        res.status(500).json({ success: false, message: 'Failed to add favorite' });
    }
});

app.delete('/api/favorites/:propertyId', async (req, res) => {
    try {
        await connectDB();
        const { propertyId } = req.params;
        const { tenantId } = req.query;
        if (!tenantId) {
            return res.status(400).json({ success: false, message: 'tenantId is required' });
        }
        const result = await favoritesCollection.deleteOne({ tenantId, propertyId });
        if (result.deletedCount === 0) {
            return res.status(404).json({ success: false, message: 'Favorite not found' });
        }
        res.json({ success: true, message: 'Property removed from favorites' });
    } catch (error) {
        console.error('Error removing favorite:', error);
        res.status(500).json({ success: false, message: 'Failed to remove favorite' });
    }
});

app.get('/api/favorites/check/:propertyId', async (req, res) => {
    try {
        await connectDB();
        const { propertyId } = req.params;
        const { tenantId } = req.query;
        if (!tenantId) {
            return res.json({ isFavorited: false });
        }
        const favorite = await favoritesCollection.findOne({ tenantId, propertyId });
        res.json({ isFavorited: !!favorite });
    } catch (error) {
        console.error('Error checking favorite:', error);
        res.json({ isFavorited: false });
    }
});

app.get('/api/favorites/my-favorites', async (req, res) => {
    try {
        await connectDB();
        const { tenantId, page = 1, limit = 10 } = req.query;
        if (!tenantId) {
            return res.status(400).json({ success: false, message: 'tenantId is required' });
        }
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const totalCount = await favoritesCollection.countDocuments({ tenantId });
        const favorites = await favoritesCollection
            .find({ tenantId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .toArray();
        const propertyIds = favorites.map(fav => fav.propertyId);
        const properties = await propertiesCollection
            .find({ _id: { $in: propertyIds.map(id => new ObjectId(id)) } })
            .toArray();
        const favoriteProperties = favorites.map(fav => {
            const property = properties.find(p => p._id.toString() === fav.propertyId);
            return { ...fav, propertyDetails: property || null };
        });
        res.json({
            success: true,
            favorites: favoriteProperties,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / parseInt(limit)),
                totalItems: totalCount,
                itemsPerPage: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error fetching favorites:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch favorites' });
    }
});

app.get('/api/favorites/all/:tenantId', async (req, res) => {
    try {
        await connectDB();
        const { tenantId } = req.params;
        const favorites = await favoritesCollection
            .find({ tenantId })
            .sort({ createdAt: -1 })
            .toArray();
        const propertyIds = favorites.map(fav => fav.propertyId);
        const properties = await propertiesCollection
            .find({ _id: { $in: propertyIds.map(id => new ObjectId(id)) } })
            .toArray();
        const favoriteProperties = favorites.map(fav => {
            const property = properties.find(p => p._id.toString() === fav.propertyId);
            return { ...fav, propertyDetails: property || null };
        });
        res.json({ success: true, favorites: favoriteProperties, count: favoriteProperties.length });
    } catch (error) {
        console.error('Error fetching all favorites:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch favorites' });
    }
});

app.get('/api/favorites/count/:propertyId', async (req, res) => {
    try {
        await connectDB();
        const { propertyId } = req.params;
        const count = await favoritesCollection.countDocuments({ propertyId });
        res.json({ success: true, count });
    } catch (error) {
        console.error('Error counting favorites:', error);
        res.status(500).json({ success: false, message: 'Failed to count favorites' });
    }
});

// ============================================================
// ==================== BOOKINGS APIS ==========================
// ============================================================

app.post('/api/bookings', async (req, res) => {
    try {
        await connectDB();
        const {
            propertyId,
            moveInDate,
            contactNumber,
            additionalNotes,
            tenantInfo,
            paymentStatus,
            paymentSessionId
        } = req.body;

        if (!propertyId || !moveInDate || !contactNumber || !tenantInfo) {
            return res.status(400).json({ success: false, message: 'Property ID, move-in date, contact number and tenant info are required' });
        }

        const property = await propertiesCollection.findOne({ _id: new ObjectId(propertyId) });
        if (!property) {
            return res.status(404).json({ success: false, message: 'Property not found' });
        }

        const existingBooking = await bookingsCollection.findOne({
            propertyId,
            tenantId: tenantInfo?.id,
            bookingStatus: { $in: ['pending', 'confirmed', 'approved'] }
        });
        if (existingBooking) {
            return res.status(400).json({ success: false, message: 'You have already booked this property' });
        }

        const booking = {
            propertyId,
            tenantId: tenantInfo?.id || 'unknown',
            ownerId: property.owner?.id || property.ownerId || 'unknown',
            propertyInfo: {
                title: property.title || 'Untitled',
                price: property.price || 0,
                location: property.location || 'N/A',
                images: property.images || []
            },
            moveInDate: new Date(moveInDate),
            contactNumber,
            additionalNotes: additionalNotes || '',
            tenantInfo: {
                name: tenantInfo?.name || 'Unknown',
                email: tenantInfo?.email || 'No email',
                phone: tenantInfo?.phone || contactNumber
            },
            bookingStatus: 'pending',
            paymentStatus: paymentStatus || 'pending',
            paymentSessionId: paymentSessionId || null,
            rejectionReason: null,
            rejectedAt: null,
            approvedAt: null,
            cancelledAt: null,
            paymentDate: paymentStatus === 'paid' ? new Date() : null,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await bookingsCollection.insertOne(booking);
        res.status(201).json({ success: true, message: 'Booking created successfully', booking: { ...booking, _id: result.insertedId } });
    } catch (error) {
        console.error('Error creating booking:', error);
        res.status(500).json({ success: false, message: 'Failed to create booking', error: error.message });
    }
});

app.patch('/api/bookings/:id/payment', async (req, res) => {
    try {
        await connectDB();
        const { id } = req.params;
        const { paymentStatus, sessionId } = req.body;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid booking ID' });
        }
        const updateData = {
            paymentStatus: paymentStatus || 'paid',
            paymentSessionId: sessionId || null,
            updatedAt: new Date()
        };
        if (paymentStatus === 'paid') {
            updateData.paymentDate = new Date();
        }
        const result = await bookingsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );
        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }
        const updatedBooking = await bookingsCollection.findOne({ _id: new ObjectId(id) });
        res.json({ success: true, message: 'Payment status updated successfully', booking: updatedBooking });
    } catch (error) {
        console.error('Error updating payment:', error);
        res.status(500).json({ success: false, message: 'Failed to update payment status', error: error.message });
    }
});

app.patch('/api/bookings/:id/status', async (req, res) => {
    try {
        await connectDB();
        const { id } = req.params;
        const { status, rejectionReason } = req.body;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid booking ID' });
        }
        const validStatuses = ['approved', 'rejected', 'cancelled', 'confirmed', 'pending'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
        }
        const updateData = { bookingStatus: status, updatedAt: new Date() };
        if (status === 'approved' || status === 'confirmed') {
            updateData.approvedAt = new Date();
        } else if (status === 'rejected') {
            updateData.rejectedAt = new Date();
            updateData.rejectionReason = rejectionReason || 'No reason provided';
        } else if (status === 'cancelled') {
            updateData.cancelledAt = new Date();
        }
        const result = await bookingsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );
        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }
        const updatedBooking = await bookingsCollection.findOne({ _id: new ObjectId(id) });
        res.json({ success: true, message: `Booking ${status} successfully`, booking: updatedBooking });
    } catch (error) {
        console.error('Error updating booking status:', error);
        res.status(500).json({ success: false, message: 'Failed to update booking status' });
    }
});

app.get('/api/bookings', async (req, res) => {
    try {
        await connectDB();
        const {
            tenantId,
            page = 1,
            limit = 10,
            status,
            search,
            isAdmin,
            ownerId
        } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const limitNum = parseInt(limit);

        let query = {};

        if (isAdmin === 'true') {
            if (status && status !== 'all' && status !== 'undefined') {
                query.bookingStatus = status;
            }
        } else if (tenantId) {
            query.tenantId = tenantId;
            if (status && status !== 'all' && status !== 'undefined') {
                query.bookingStatus = status;
            }
        } else if (ownerId) {
            query.ownerId = ownerId;
            if (status && status !== 'all' && status !== 'undefined') {
                query.bookingStatus = status;
            }
        } else {
            return res.status(400).json({ success: false, message: 'tenantId, ownerId, or isAdmin is required' });
        }

        if (search) {
            query.$or = [
                { 'propertyInfo.title': { $regex: search, $options: 'i' } },
                { 'tenantInfo.name': { $regex: search, $options: 'i' } },
                { 'tenantInfo.email': { $regex: search, $options: 'i' } },
                { 'propertyInfo.location': { $regex: search, $options: 'i' } }
            ];
        }

        const bookings = await bookingsCollection
            .find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .toArray();

        const totalCount = await bookingsCollection.countDocuments(query);

        const bookingsWithDetails = await Promise.all(bookings.map(async (booking) => {
            try {
                const property = await propertiesCollection.findOne({
                    _id: new ObjectId(booking.propertyId)
                });
                return { ...booking, propertyDetails: property || null };
            } catch (err) {
                return { ...booking, propertyDetails: null };
            }
        }));

        res.json({
            success: true,
            bookings: bookingsWithDetails,
            totalItems: totalCount,
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalCount / limitNum) || 1,
            itemsPerPage: limitNum
        });
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch bookings', error: error.message });
    }
});

app.get('/api/bookings/owner/:ownerId', async (req, res) => {
    try {
        await connectDB();
        const { ownerId } = req.params;
        const { status, search, page = 1, limit = 10 } = req.query;

        const query = { ownerId };
        if (status && status !== 'all' && status !== 'undefined') {
            query.bookingStatus = status;
        }

        if (search) {
            query.$or = [
                { 'propertyInfo.title': { $regex: search, $options: 'i' } },
                { 'tenantInfo.name': { $regex: search, $options: 'i' } },
                { 'propertyInfo.location': { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const limitNum = parseInt(limit);
        const totalCount = await bookingsCollection.countDocuments(query);

        const bookings = await bookingsCollection
            .find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .toArray();

        const bookingsWithDetails = await Promise.all(bookings.map(async (booking) => {
            try {
                const property = await propertiesCollection.findOne({
                    _id: new ObjectId(booking.propertyId)
                });
                return { ...booking, propertyDetails: property || null };
            } catch (err) {
                return { ...booking, propertyDetails: null };
            }
        }));

        res.json({
            success: true,
            bookings: bookingsWithDetails,
            count: bookingsWithDetails.length,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limitNum),
                totalItems: totalCount,
                itemsPerPage: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error fetching owner bookings:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch bookings' });
    }
});

app.get('/api/bookings/my-bookings', async (req, res) => {
    try {
        await connectDB();
        const { tenantId, page = 1, limit = 10, status, search } = req.query;
        if (!tenantId) {
            return res.status(400).json({ success: false, message: 'tenantId is required' });
        }
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const query = { tenantId };
        if (status && status !== 'all' && status !== 'undefined') {
            query.bookingStatus = status;
        }
        if (search) {
            query.$or = [
                { 'propertyInfo.title': { $regex: search, $options: 'i' } },
                { 'propertyInfo.location': { $regex: search, $options: 'i' } }
            ];
        }
        const totalCount = await bookingsCollection.countDocuments(query);
        const bookings = await bookingsCollection
            .find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .toArray();

        const bookingsWithDetails = await Promise.all(bookings.map(async (booking) => {
            try {
                const property = await propertiesCollection.findOne({
                    _id: new ObjectId(booking.propertyId)
                });
                return { ...booking, propertyDetails: property || null };
            } catch (err) {
                return { ...booking, propertyDetails: null };
            }
        }));

        res.json({
            success: true,
            bookings: bookingsWithDetails,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / parseInt(limit)),
                totalItems: totalCount,
                itemsPerPage: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch bookings' });
    }
});

app.get('/api/bookings/:id', async (req, res) => {
    try {
        await connectDB();
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid booking ID' });
        }
        const booking = await bookingsCollection.findOne({ _id: new ObjectId(id) });
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }
        let property = null;
        try {
            property = await propertiesCollection.findOne({
                _id: new ObjectId(booking.propertyId)
            });
        } catch (err) {
            console.error('Error fetching property:', err);
        }
        res.json({ success: true, booking: { ...booking, propertyDetails: property || null } });
    } catch (error) {
        console.error('Error fetching booking:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch booking' });
    }
});

app.delete('/api/bookings/:id', async (req, res) => {
    try {
        await connectDB();
        const { id } = req.params;
        const { tenantId } = req.query;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid booking ID' });
        }
        const booking = await bookingsCollection.findOne({ _id: new ObjectId(id) });
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }
        if (booking.bookingStatus !== 'pending') {
            return res.status(400).json({ success: false, message: 'Only pending bookings can be cancelled' });
        }
        await bookingsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { bookingStatus: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() } }
        );
        res.json({ success: true, message: 'Booking cancelled successfully' });
    } catch (error) {
        console.error('Error cancelling booking:', error);
        res.status(500).json({ success: false, message: 'Failed to cancel booking' });
    }
});

// ============================================================
// ==================== REVIEWS APIS ===========================
// ============================================================

app.post('/api/reviews', async (req, res) => {
    try {
        await connectDB();
        const { propertyId, tenantId, tenantName, tenantEmail, rating, comment } = req.body;

        if (!propertyId || !tenantId || !rating || !comment) {
            return res.status(400).json({ success: false, message: 'Property ID, Tenant ID, rating and comment are required' });
        }
        if (rating < 1 || rating > 5) {
            return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
        }

        const booking = await bookingsCollection.findOne({
            propertyId,
            tenantId,
            bookingStatus: { $in: ['confirmed', 'approved', 'completed'] }
        });
        if (!booking) {
            return res.status(403).json({ success: false, message: 'You can only review properties you have booked' });
        }

        const existingReview = await reviewsCollection.findOne({ propertyId, tenantId });
        if (existingReview) {
            return res.status(400).json({ success: false, message: 'You have already reviewed this property' });
        }

        const property = await propertiesCollection.findOne({ _id: new ObjectId(propertyId) });
        const user = await usersCollection.findOne({ _id: new ObjectId(tenantId) });

        const review = {
            propertyId,
            tenantId,
            tenantName: tenantName || user?.name || 'Anonymous',
            tenantEmail: tenantEmail || user?.email || '',
            tenantPhoto: user?.image || user?.photo || null,
            rating: parseInt(rating),
            comment,
            propertyTitle: property?.title || 'Property',
            propertyImage: property?.images?.[0] || null,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await reviewsCollection.insertOne(review);
        res.status(201).json({ success: true, message: 'Review added successfully', review: { ...review, _id: result.insertedId } });
    } catch (error) {
        console.error('Error creating review:', error);
        res.status(500).json({ success: false, message: 'Failed to create review', error: error.message });
    }
});

app.get('/api/reviews/:propertyId', async (req, res) => {
    try {
        await connectDB();
        const { propertyId } = req.params;
        const { limit = 10 } = req.query;

        const reviews = await reviewsCollection
            .find({ propertyId })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .toArray();

        const totalReviews = reviews.length;
        const averageRating = totalReviews > 0
            ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
            : 0;

        res.json({
            success: true,
            reviews,
            totalReviews,
            averageRating: averageRating.toFixed(1)
        });
    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch reviews', error: error.message });
    }
});

app.get('/api/reviews', async (req, res) => {
    try {
        await connectDB();
        const { limit = 4 } = req.query;

        const reviews = await reviewsCollection
            .find({})
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .toArray();

        res.json({ success: true, reviews, count: reviews.length });
    } catch (error) {
        console.error('Error fetching all reviews:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch reviews', error: error.message });
    }
});

app.get('/api/reviews/check/:propertyId/:tenantId', async (req, res) => {
    try {
        await connectDB();
        const { propertyId, tenantId } = req.params;

        const booking = await bookingsCollection.findOne({
            propertyId,
            tenantId,
            bookingStatus: { $in: ['confirmed', 'approved', 'completed'] }
        });

        if (!booking) {
            return res.json({
                success: true,
                canReview: false,
                message: 'You need to book this property first'
            });
        }

        const existingReview = await reviewsCollection.findOne({ propertyId, tenantId });

        res.json({
            success: true,
            canReview: !existingReview,
            alreadyReviewed: !!existingReview,
            message: existingReview ? 'You already reviewed this property' : 'You can review this property'
        });
    } catch (error) {
        console.error('Error checking review:', error);
        res.json({ success: false, canReview: false, message: 'Error checking review status' });
    }
});

// ============================================================
// ==================== STRIPE CHECKOUT SESSION ================
// ============================================================

app.post('/api/create-checkout-session', async (req, res) => {
    try {
        const { propertyId, propertyTitle, propertyPrice, bookingId } = req.body;

        if (!propertyId || !propertyTitle || !propertyPrice || !bookingId) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: propertyTitle,
                        description: `Booking payment for ${propertyTitle}`,
                        metadata: { propertyId, bookingId }
                    },
                    unit_amount: Math.round(Number(propertyPrice) * 100)
                },
                quantity: 1
            }],
            mode: 'payment',
            success_url: `${process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000'}/payment/success?session_id={CHECKOUT_SESSION_ID}&bookingId=${bookingId}`,
            cancel_url: `${process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000'}/payment/cancelled?bookingId=${bookingId}`,
            metadata: { propertyId, bookingId, amount: String(propertyPrice) }
        });

        res.json({ success: true, sessionId: session.id, url: session.url });
    } catch (error) {
        console.error('Stripe error:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to create payment session' });
    }
});

// ============================================================
// ==================== DASHBOARD STATS ========================
// ============================================================

app.get('/api/admin/stats', async (req, res) => {
    try {
        await connectDB();
        const totalUsers = await usersCollection.countDocuments();
        const totalProperties = await propertiesCollection.countDocuments();
        const pendingProperties = await propertiesCollection.countDocuments({ status: 'pending' });
        const totalBookings = await bookingsCollection.countDocuments();
        const confirmedBookings = await bookingsCollection.countDocuments({ bookingStatus: 'confirmed' });

        const revenueResult = await bookingsCollection.aggregate([
            { $match: { paymentStatus: 'paid', paymentDate: { $exists: true } } },
            { $group: { _id: null, totalRevenue: { $sum: '$propertyInfo.price' } } }
        ]).toArray();

        const totalRevenue = revenueResult[0]?.totalRevenue || 0;

        const now = new Date();
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

        const currentMonthRevenue = await bookingsCollection.aggregate([
            { $match: { paymentStatus: 'paid', paymentDate: { $gte: currentMonthStart, $lte: now } } },
            { $group: { _id: null, total: { $sum: '$propertyInfo.price' } } }
        ]).toArray();

        const lastMonthRevenue = await bookingsCollection.aggregate([
            { $match: { paymentStatus: 'paid', paymentDate: { $gte: lastMonthStart, $lte: lastMonthEnd } } },
            { $group: { _id: null, total: { $sum: '$propertyInfo.price' } } }
        ]).toArray();

        const currentMonth = currentMonthRevenue[0]?.total || 0;
        const lastMonth = lastMonthRevenue[0]?.total || 0;

        let monthlyGrowth = 0;
        if (lastMonth > 0) {
            monthlyGrowth = Math.round(((currentMonth - lastMonth) / lastMonth) * 100);
        } else if (currentMonth > 0) {
            monthlyGrowth = 100;
        }

        res.json({
            success: true,
            stats: {
                totalUsers,
                totalProperties,
                pendingProperties,
                totalBookings,
                confirmedBookings,
                totalRevenue,
                monthlyGrowth
            }
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch stats' });
    }
});

app.get('/api/owner/stats/:ownerId', async (req, res) => {
    try {
        await connectDB();
        const { ownerId } = req.params;

        const totalProperties = await propertiesCollection.countDocuments({
            $or: [{ 'ownerId': ownerId }, { 'owner.id': ownerId }]
        });

        const totalBookings = await bookingsCollection.countDocuments({ ownerId });
        const confirmedBookings = await bookingsCollection.countDocuments({ ownerId, bookingStatus: 'confirmed' });
        const pendingBookings = await bookingsCollection.countDocuments({ ownerId, bookingStatus: 'pending' });

        const monthlyEarnings = await getMonthlyEarnings(ownerId);
        const totalEarnings = monthlyEarnings.reduce((sum, item) => sum + item.earnings, 0);

        const recentBookings = await bookingsCollection
            .find({ ownerId })
            .sort({ createdAt: -1 })
            .limit(5)
            .toArray();

        res.json({
            success: true,
            stats: {
                totalProperties,
                totalBookings,
                confirmedBookings,
                pendingBookings,
                totalEarnings,
                monthlyEarnings,
                recentBookings
            }
        });
    } catch (error) {
        console.error('Error fetching owner stats:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch stats' });
    }
});

// ✅ Helper function - Get monthly earnings
async function getMonthlyEarnings(ownerId) {
    const months = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
            month: date.toLocaleString('default', { month: 'short' }),
            year: date.getFullYear(),
            earnings: 0
        });
    }

    const bookings = await bookingsCollection.find({
        ownerId,
        bookingStatus: { $in: ['confirmed', 'approved', 'pending'] },
        paymentStatus: 'paid',
        paymentDate: { $exists: true }
    }).toArray();

    bookings.forEach(booking => {
        if (!booking.paymentDate) return;
        const paymentDate = new Date(booking.paymentDate);
        const monthKey = paymentDate.toLocaleString('default', { month: 'short' });
        const yearKey = paymentDate.getFullYear();

        months.forEach(month => {
            if (month.month === monthKey && month.year === yearKey) {
                month.earnings += booking.propertyInfo?.price || 0;
            }
        });
    });

    return months;
}

// ============================================================
// ==================== TRANSACTIONS APIS ======================
// ============================================================

app.get('/api/admin/transactions', async (req, res) => {
    try {
        await connectDB();
        const { page = 1, limit = 10, status, search } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const limitNum = parseInt(limit);

        let query = {};
        if (status && status !== 'all' && status !== 'undefined') {
            query.paymentStatus = status;
        }

        if (search) {
            query.$or = [
                { 'propertyInfo.title': { $regex: search, $options: 'i' } },
                { 'tenantInfo.name': { $regex: search, $options: 'i' } },
                { 'tenantInfo.email': { $regex: search, $options: 'i' } },
                { '_id': { $regex: search, $options: 'i' } }
            ];
        }

        const transactions = await bookingsCollection
            .find({ ...query, paymentStatus: 'paid' })
            .sort({ paymentDate: -1, createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .toArray();

        const totalCount = await bookingsCollection.countDocuments({ ...query, paymentStatus: 'paid' });

        const formattedTransactions = await Promise.all(transactions.map(async (booking) => {
            let ownerName = 'N/A';

            if (booking.ownerName) {
                ownerName = booking.ownerName;
            } else if (booking.ownerId) {
                try {
                    const owner = await usersCollection.findOne({
                        _id: new ObjectId(booking.ownerId)
                    });
                    if (owner) {
                        ownerName = owner.name || 'N/A';
                    }
                } catch (err) {
                    console.error('Error fetching owner:', err);
                }
            }

            return {
                _id: booking._id,
                transactionId: booking._id,
                propertyInfo: booking.propertyInfo || { title: 'N/A', location: 'N/A', price: 0 },
                tenantInfo: booking.tenantInfo || { name: 'Unknown', email: 'N/A', phone: 'N/A' },
                ownerInfo: { name: ownerName, id: booking.ownerId || 'N/A' },
                ownerName,
                amount: booking.propertyInfo?.price || 0,
                status: booking.paymentStatus || 'paid',
                paymentType: 'booking',
                paymentMethod: 'stripe',
                paymentSessionId: booking.paymentSessionId || null,
                paymentDate: booking.paymentDate || booking.createdAt,
                createdAt: booking.createdAt,
                updatedAt: booking.updatedAt,
                additionalNotes: booking.additionalNotes || null,
                bookingStatus: booking.bookingStatus || 'pending'
            };
        }));

        res.json({
            success: true,
            transactions: formattedTransactions,
            totalItems: totalCount,
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalCount / limitNum),
            itemsPerPage: limitNum
        });
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch transactions', error: error.message });
    }
});

app.get('/api/admin/transactions/:id', async (req, res) => {
    try {
        await connectDB();
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid transaction ID' });
        }
        const booking = await bookingsCollection.findOne({
            _id: new ObjectId(id),
            paymentStatus: 'paid'
        });
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Transaction not found' });
        }

        let ownerName = 'N/A';
        if (booking.ownerName) {
            ownerName = booking.ownerName;
        } else if (booking.ownerId) {
            try {
                const owner = await usersCollection.findOne({
                    _id: new ObjectId(booking.ownerId)
                });
                if (owner) {
                    ownerName = owner.name || 'N/A';
                }
            } catch (err) {
                console.error('Error fetching owner:', err);
            }
        }

        const transaction = {
            _id: booking._id,
            transactionId: booking._id,
            propertyInfo: booking.propertyInfo || { title: 'N/A', location: 'N/A', price: 0 },
            tenantInfo: booking.tenantInfo || { name: 'Unknown', email: 'N/A', phone: 'N/A' },
            ownerInfo: { name: ownerName, id: booking.ownerId || 'N/A' },
            ownerName,
            amount: booking.propertyInfo?.price || 0,
            status: booking.paymentStatus || 'paid',
            paymentType: 'booking',
            paymentMethod: 'stripe',
            paymentSessionId: booking.paymentSessionId || null,
            paymentDate: booking.paymentDate || booking.createdAt,
            createdAt: booking.createdAt,
            updatedAt: booking.updatedAt,
            additionalNotes: booking.additionalNotes || null,
            bookingStatus: booking.bookingStatus || 'pending'
        };

        res.json({ success: true, transaction });
    } catch (error) {
        console.error('Error fetching transaction:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch transaction', error: error.message });
    }
});

app.get('/api/admin/transactions/stats', async (req, res) => {
    try {
        await connectDB();
        const totalTransactions = await bookingsCollection.countDocuments({ paymentStatus: 'paid' });

        const revenueResult = await bookingsCollection.aggregate([
            { $match: { paymentStatus: 'paid' } },
            { $group: { _id: null, total: { $sum: '$propertyInfo.price' } } }
        ]).toArray();
        const totalRevenue = revenueResult[0]?.total || 0;

        const successful = await bookingsCollection.countDocuments({ paymentStatus: 'paid' });
        const pending = await bookingsCollection.countDocuments({ paymentStatus: 'pending' });
        const failed = await bookingsCollection.countDocuments({ paymentStatus: 'failed' });

        res.json({
            success: true,
            stats: {
                totalTransactions,
                totalRevenue,
                successful,
                pending,
                failed
            }
        });
    } catch (error) {
        console.error('Error fetching transaction stats:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch transaction stats', error: error.message });
    }
});

// ============================================================
// ==================== VERCEL EXPORT ===========================
// ============================================================

// ✅ For Vercel Serverless
module.exports = app;

// ✅ For Local Development
if (require.main === module) {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, async () => {
        console.log(`🚀 Server running on port ${PORT}`);
        try {
            await connectDB();
        } catch (error) {
            console.error('❌ Failed to connect to MongoDB:', error);
        }
    });
}