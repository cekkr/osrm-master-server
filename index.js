// server.js
import express from 'express';
import fetch from 'node-fetch';

import { spawn } from 'child_process';
import net from 'net';

import Settings from './config.js'

const app = express();
const port = 5000; // The port your proxy server will run on

// List of your OSRM servers
let routes = {}

// A simple function to fetch routes from an OSRM server
async function fetchRouteFromOSRM(server, coordinates) {
    const url = `${server}/route/v1/driving/${coordinates}?overview=full`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch from ${server}`);
        }
        const data = await response.json();
        return data.routes[0]; // Assuming we're interested in the first route
    } catch (error) {
        console.error(error);
        return null;
    }
}

// Merge routes from different OSRM servers
// This function is highly simplified and assumes routes are directly mergeable
// Real-world usage may require more sophisticated merging based on route properties
async function mergeRoutes(coordinates) {
    let osrmServers = []
    for (let port in routes)
        osrmServers.push('http://localhost:' + port)

    const routePromises = osrmServers.map(server => fetchRouteFromOSRM(server, coordinates));
    const routes = await Promise.all(routePromises);

    // Filter out any null responses and then merge routes as needed
    // For demonstration, we're simply returning the collected routes
    // A real merge would consider how to combine these routes intelligently
    return routes.filter(route => route !== null);
}

// Define a route handler for your Express server to accept route requests
app.get('/route/:coordinates', async (req, res) => {
    const { coordinates } = req.params;
    try {
        const mergedRoutes = await mergeRoutes(coordinates);
        res.json({ routes: mergedRoutes });
    } catch (error) {
        res.status(500).send('Failed to merge routes');
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});


///
///
///

// Function to check if a port is available
function checkPort(port) {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.listen(port, () => {
            server.close(() => resolve(true)); // Port is available
        });
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                resolve(false); // Port is in use
            } else {
                reject(err); // Some other error
            }
        });
    });
}

// Function to find the first available port starting from a given port
async function findAvailablePort(startPort) {
    let port = startPort;
    while (true) {
        if (await checkPort(port) && !routes[port]) {
            return port;
        }
        port++;
    }
}

// Function to start an osrm-routed server with the first available port
async function startOsrmServer(osrmPaths) {
    const startPort = 5001;
    const port = await findAvailablePort(startPort);

    let route = routes[port] = {}

    // Attempt to start an OSRM server for each path until one succeeds
    for (const path of osrmPaths) {
        try {
            const osrmProcess = spawn('osrm-routed', ['--algorithm', 'mld', path, '-p', port.toString()], { stdio: 'inherit' });
            route.process = osrmProcess

            osrmProcess.on('error', (err) => {
                console.error(`Failed to start osrm-routed for ${path}:`, err);
            });

            console.log(`osrm-routed server started for ${path} on port ${port}`);
            break; // Stop after successfully starting the first server
        } catch (error) {
            console.error(`Error starting osrm-routed server for ${path}:`, error);
        }
    }
}

// Example usage with a list of OSRM data paths
//const osrmPaths = ['/path/to/your-data.osrm', '/another/path/data.osrm'];
startOsrmServer(Settings.routes).catch(console.error);