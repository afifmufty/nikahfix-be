import express from "express";
import cors from "cors";
import helmet from "helmet";
import PinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import "dotenv/config";

import supabaseDatabase from "./supabaseDatabase.js";

// env
const { APP_PORT, APP_NAME } = process.env;

const app = express();

// middleware
app.use(PinoHttp());
app.use(helmet());

// CORS + preflight (penting untuk axios POST JSON)
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.options("*", cors());

app.use(express.json());

// rate limit
const limitter = rateLimit({
  windowMs: 5000,
  limit: 5,
  handler: (req, res) => {
    res.status(429).send({
      message: "Too many requests, please try again later.",
    });
  },
});

// routing
app.get("/", (req, res) => {
  return res.status(200).send({
    message: `${APP_NAME || "backend"} run normally OK`,
  });
});

app.post("/wish", limitter, async (req, res) => {
  try {
    const { name, message } = req.body;

    if (!name || name.length < 3 || !message) {
      return res.status(400).send({ message: "bad input user" });
    }

    const nameLower = name.toLowerCase();

    const getWishs = await supabaseDatabase
      .from("wishs")
      .select("*", { returning: "minimal" })
      .eq("name", nameLower);

    if (getWishs.error) {
      return res.status(500).send({
        message: getWishs.error.message || "failed get data",
      });
    }

    if (getWishs.data && getWishs.data.length > 0) {
      return res.status(400).send({ message: "oops you already send wish" });
    }

    const insert = await supabaseDatabase.from("wishs").insert(
      { name: nameLower, message },
      { returning: "minimal" }
    );

    if (insert.error) {
      return res.status(500).send({
        message: insert.error.message || "failed insert data",
      });
    }

    return res.status(200).send({ message: "success insert" });
  } catch (error) {
    return res.status(500).send({ message: error.message || "error post wish" });
  }
});

app.get("/wish", async (req, res) => {
  try {
    const { data, error } = await supabaseDatabase
      .from("wishs")
      .select("*", { returning: "minimal" });

    if (error) {
      return res.status(500).send({ message: "failed get data" });
    }

    return res.status(200).send({
      data,
      message: "success get data",
    });
  } catch (error) {
    return res.status(500).send({ message: error.message || "error get wish" });
  }
});

// =======================
// ADMIN - GENERATE GUEST
// =======================
app.post("/admin/guest", async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) return res.status(400).json({ message: "name is required" });

    const slug =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") +
      "-" +
      Math.random().toString(36).substring(2, 7);

    const { data, error } = await supabaseDatabase
      .from("guests")
      .insert([{ name, slug }])
      .select()
      .single();

    if (error) {
      console.error(error);
      return res.status(500).json({ message: "failed generate guest" });
    }

    return res.json({
      name: data.name,
      slug: data.slug,
      url: `http://wedding.local:8181/?guest=${data.slug}`,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "internal server error" });
  }
});

// =======================
// PUBLIC - GET GUEST NAME
// =======================
app.get("/guest/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    const { data, error } = await supabaseDatabase
      .from("guests")
      .select("name")
      .eq("slug", slug)
      .single();

    if (error || !data) return res.status(404).json({ message: "guest not found" });

    return res.json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "internal server error" });
  }
});

// listen (taruh paling bawah)
app.listen(APP_PORT || 3001, "0.0.0.0", () => {
  console.log(`${APP_NAME || "app"} REST API RUN at PORT ${APP_PORT || 3001}`);
});
