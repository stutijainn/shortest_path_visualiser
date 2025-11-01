# Shortest Path Visualiser (simple React + Node static server)

This is a minimal interactive graph canvas where you can add and delete nodes and drag them around.

Quick start (Windows PowerShell):

1. Install dependencies:

```powershell
cd 'c:\Users\stuti\OneDrive\Desktop\shortest_path_visualiser'
npm install
```

2. Start the server:

```powershell
npm start
```

3. Open in your browser:

http://localhost:3000

Notes:
- The frontend uses React via CDN and Babel in the browser for quick iteration (no build step).
- Click the canvas to add nodes at that position, or use the Add Node button to add at a random spot.
- Click a node to select it, drag to move it. Use Delete Selected to remove it.
 - Click the canvas to add nodes at that position, or use the Add Node button to add at a random spot.
 - Click a node to select it, drag to move it. Use Delete Selected to remove it.
 - The app autosaves your graph (nodes and edges) to your browser's localStorage. Refreshing the page will restore your last graph automatically.
 - Use the Run Dijkstra controls: choose Start and optional End, click Prepare to compute the algorithm steps, then Play or Step through the execution. Use the Speed slider to control playback speed.
 - The app autosaves your graph (nodes and edges) to your browser's localStorage. Refreshing the page will restore your last graph automatically.
 - Use the Run Dijkstra controls: choose Start and optional End, click Prepare to compute the algorithm steps, then Play or Step through the execution. Use the Speed slider to control playback speed.
 - You can Undo recent changes (nodes/edges edits) with the Undo button.
 - Click an edge to select it; edit its weight or delete it from the controls panel. The step table and log show the algorithm progress; click any row to jump to that step.
 - During playback the app shows per-node current distances next to each node and highlights the currently considered/relaxed edge with an arrow indicating the direction of consideration. The Log now shows a friendly textual description for each step.

If you'd like this deployed to a public URL, I can help prepare a GitHub repo and GitHub Pages or deploy to Vercel/Heroku (you'll need to push the repo or grant deploy access).
