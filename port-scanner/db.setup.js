const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/csekapp', {
  dbName: 'csekapp_db',
});

const ScanSchema = new mongoose.Schema(
  {},
  {
    strict: false,
  },
);

const Scan = mongoose.model('Scan', ScanSchema);

module.exports = Scan;
