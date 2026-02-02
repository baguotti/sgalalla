import http from "http";
import express from "express";
import cors from "cors";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { GameRoom } from "./rooms/GameRoom";
import { PhysicsConfig } from "@shared/physics/PhysicsConfig";

const port = Number(process.env.PORT || 2567);
const app = express();

app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const gameServer = new Server({
    transport: new WebSocketTransport({
        server: server
    })
});

gameServer.define('game_room', GameRoom);

gameServer.listen(port, "0.0.0.0");
console.log(`Listening on ws://localhost:${port} (and 0.0.0.0:${port})`);
console.log(`Shared Config Loaded! Gravity: ${PhysicsConfig.GRAVITY}`);
