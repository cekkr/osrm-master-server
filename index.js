// server.js
import express from 'express';
import fetch from 'node-fetch';

const app = express();
const port = 3000; // The port your proxy server will run on

// List of your OSRM servers
const osrmServers = [
  'http://localhost:5001',
  'http://localhost:5002',
  // Add more servers as needed
];

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
