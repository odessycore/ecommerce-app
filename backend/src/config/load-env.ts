import { config } from 'dotenv';

// Loaded before AppModule is evaluated so module-level decisions (e.g. whether to wire up
// the BullMQ workers) can read the resolved environment.
config();
