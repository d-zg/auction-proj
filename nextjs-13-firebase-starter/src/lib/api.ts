import axios from 'axios';

const apiURL = 'http://localhost:8000' // Make sure this matches your backend URL
export const api = axios.create({
    baseURL: apiURL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
})