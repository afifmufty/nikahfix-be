import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import PinoHttp from 'pino-http';
import rateLimit from 'express-rate-limit';
import 'dotenv/config';

import supabaseDatabase from './supabaseDatabase.js';
// env
const { APP_PORT, APP_NAME } = process.env;
const limitter = rateLimit({
  windowMs: 5000,
  limit: 5,
  handler: (req, res) => {
    res.status(429).send({
      message: 'Too many requests, please try again later.',
    });
  },
});
const app = express();
app.use(PinoHttp());
app.use(cors());
app.use(helmet());

app.use(express.json());

app.listen(APP_PORT || 3000, '0.0.0.0', () => {
  console.log(`${APP_NAME} REST API RUN at PORT ${APP_PORT}`);
});

// routing
app.get('/', (req, res) => {
  try {
    return res.status(200).send({
      message: `${APP_NAME || 'backend'} run normally OK`,
    });
  } catch (error) {
    return res.status(500).send({
      message: error.message || `error when get index`,
    });
  }
});
app.post('/wish', limitter, async (req, res) => {
  try {
    const { name, message } = req.body;
    if (!name || name.length < 3 || !message) {
      return res.status(400).send({
        message: `bad input user`,
      });
    }
    const getWishs = await supabaseDatabase
      .from('wishs')
      .select('*', { returning: 'minimal' })
      .eq('name', name.toLowerCase());
    if (getWishs.error) {
      return res.status(500).send({
        message: getWishs.error.message || 'failed insert data',
      });
    }
    if (getWishs.data && getWishs.data.length > 0) {
      return res.status(400).send({
        message: `oops you already send wish`,
      });
    }
    const nameLower = name.toLowerCase();
    const insert = await supabaseDatabase.from('wishs').insert(
      {
        name: nameLower,
        message,
      },
      { returning: 'minimal' }
    );
    if (insert.error) {
      return res.status(500).send({
        message: insert.error.message || 'failed insert data',
      });
    }
    return res.status(200).send({
      message: 'success insert',
    });
  } catch (error) {
    return res.status(500).send({
      message: error.message || `error post wish`,
    });
  }
});
app.get('/wish', async (req, res) => {
  try {
    const { data, error } = await supabaseDatabase
      .from('wishs')
      .select('*', { returning: 'minimal' });
    if (error) {
      return res.status(500).send({
        message: 'failed get data',
      });
    }
    return res.status(200).send({
      data: data,
      message: 'success get data',
    });
  } catch (error) {
    return res.status(500).send({
      message: error.message || `error when get wish`,
    });
  }
});
