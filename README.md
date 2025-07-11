<div style="text-align: center;">
  <img src="https://github.com/user-attachments/assets/15544e6e-5e91-4215-aa72-e4102be39003" alt="pixel-frame-cropped" style="display: block; margin: 0 auto;" width="300">
  <br>
  <a href="YOUR_PROJECT_LIVE_DEMO_LINK_HERE" target="_blank">View Live Demo</a>
  <br><br> <div style="text-align: center;">
    <a href="YOUR_LINKEDIN_PROFILE_URL" target="_blank" style="margin: 0 5px;">
      <img src="https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white" alt="LinkedIn Profile">
    </a>
    <a href="https://github.com/YOUR_USERNAME/YOUR_REPOSITORY/commits/main" target="_blank" style="margin: 0 5px;">
      <img src="https://img.shields.io/github/commits-since/YOUR_USERNAME/YOUR_REPOSITORY/main?style=for-the-badge&label=commits" alt="Commits Since Last Release">
    </a>
    <a href="https://github.com/YOUR_USERNAME/YOUR_REPOSITORY/graphs/contributors" target="_blank" style="margin: 0 5px;">
      <img src="https://img.shields.io/github/contributors/YOUR_USERNAME/YOUR_REPOSITORY?style=for-the-badge&label=contributors" alt="Contributors">
    </a>
  </div>
</div>

# Brief
A 64x64 LED matrix in a picture frame, controlled via a web interface. Draw with friends in real-time using a WebSocket-powered backend and watch the wall art come to life on a microcontroller-driven display.

# How to run
This project uses a monorepo with pnpm. Inside of the apps folder, there are 3 main parts:

* **Backend:**
  ```bash
  uvicorn main:app --reload --host 0.0.0.0 --port 8000
  ```

* **Frontend:**
  ```bash
  npx vite
  ```

* **Firmware:**
  Using Arduino IDE, make sure you have a `secrets.h` in the same directory, then compile and send the script to your Adafruit Matrix Portal.
  
