<div style="text-align: center;">
  <img src="https://github.com/user-attachments/assets/15544e6e-5e91-4215-aa72-e4102be39003" alt="pixel-frame-cropped" style="display: block; margin: 0 auto;" width=500>
  <br> <p>
    <a href="https://www.linkedin.com/in/ethan-knotts-4b349a2b6/" target="_blank">
      <img src="https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white" alt="LinkedIn Profile">
    </a>
    <a href="https://github.com/ethank64/pixel-frame/commits/main" target="_blank">
      <img src="https://img.shields.io/github/commits-since/ethank64/pixel-frame/main?style=for-the-badge&label=commits" alt="Commits Since Last Release">
    </a>
    <a href="https://github.com/ethank64/pixel-frame/graphs/contributors" target="_blank">
      <img src="https://img.shields.io/github/contributors/ethank64/pixel-frame?style=for-the-badge&label=contributors" alt="Contributors">
    </a>
  </p>
</div>

# Brief
A 64x64 LED matrix in a picture frame, controlled via a web interface. Draw with friends in real-time using a WebSocket-powered backend and watch the wall art come to life on a microcontroller-driven display.

# How to run
This project uses a monorepo with pnpm. Inside of the apps folder, there are 3 main parts:

* **Backend:**
  ```bash
  python main.py
  ```

* **Frontend:**
  ```bash
  npx vite
  ```

* **Firmware:**
  Using Arduino IDE, make sure you have a `secrets.h` in the same directory, then compile and send the script to your Adafruit Matrix Portal.
  
  **Make sure** to set the `WEBSOCKETS_MAX_DATA_SIZE` **in the original source code** for the websocket library. Image uploads will not work if you don't.
  
