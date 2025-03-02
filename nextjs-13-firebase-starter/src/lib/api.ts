import axios from 'axios';

const apiURL = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000'; // Read from env var, default to localhost
export const api = axios.create({
    baseURL: apiURL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
})