import { Client, addVoiceStat } from '@/structures';
import { VoiceChannel } from 'discord.js';
import mongoose from 'mongoose';

const client = new Client();
mongoose.set('strictQuery', false);

client.connect();

process.on('unhandledRejection', (error: Error) => console.log(`${error.name}: ${error.message}`));
process.on('uncaughtException', (error: Error) => console.log(`${error.name}: ${error.message}`));
