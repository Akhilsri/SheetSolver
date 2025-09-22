# SheetSolver - Collaborative DSA Platform 🚀

<p align="center">
  <img src="https://res.cloudinary.com/dnrg0ji04/image/upload/v1758554754/WhatsApp_Image_2025-09-22_at_20.45.11_096cd3eb_waehjl.jpg" alt="SheetSolver App Screenshot" width="300"/>
  <br>
  <i>An end-to-end mobile application that transforms solitary DSA practice into a collaborative, competitive, and engaging team sport.</i>
</p>

## Table of Contents

- [Introduction](#introduction)
- [Gallery](#gallery)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
- [Setup & Installation](#setup--installation)
- [Key Achievements & Learnings](#key-achievements--learnings)
- [Future Enhancements](#future-enhancements)

---

## Introduction

SheetSolver is a full-stack, real-time mobile application designed to revolutionize how students and SDE aspirants approach Data Structures & Algorithms (DSA) preparation. Moving beyond isolated problem-solving, SheetSolver fosters a collaborative environment where users can form study rooms, tackle popular DSA sheets together, compete in real-time challenges, and hold each other accountable.

The core vision is to combat the procrastination and lack of motivation inherent in solo self-study by leveraging social interaction, gamification, and structured learning paths.

## Gallery

| Profile Dashboard | Compete Mode | Room Details |
| :---: | :---: | :---: |
| <img src="URL_to_your_screenshot" width="200"/> | <img src="URL_to_your_screenshot" width="200"/> | <img src="URL_to_your_screenshot" width="200"/> |

*(**Note:** You can upload your screenshots like [this one]() to a site like Imgur and place the URLs in the `src` attribute above.)*

## Features

### **Real-time Collaboration & Competition**
- **Collaborative Rooms:** Create private, admin-controlled rooms for specific DSA sheets.
- **"Compete" Mode:** Engage in live, 1-on-1 competitive quizzes with random matchmaking, timed questions, and a persistent ELO rating system.
- **Chat & Messaging:** Integrated real-time chat for both rooms and 1-on-1 private conversations between connected users.

### **Gamification & Accountability**
- **Personalized Dashboard:** A polished dashboard showcasing a user's streaks, active journeys, and a GitHub-style activity calendar.
- **Streaks & Leaderboards:** Maintain a daily solving streak (🔥) and compete with room members on a real-time leaderboard.
- **"Proof of Solve":** A unique accountability feature where users upload a photo of their solved problem, which is visible to teammates for 24 hours.

### **Content & Social Features**
- **User-Generated Content:** Users can create and upload their own custom DSA sheets via CSV, making the platform infinitely scalable.
- **AI-Powered Quizzes:** Leverages the Google Gemini API to dynamically generate an endless supply of unique quiz questions for the "Compete" mode.
- **Social Networking:** A full social layer with searchable user profiles, a friend/connection system with requests and approvals, and social link sharing.
- **Notification System:** A comprehensive notification center with unread badges and real-time push notifications via Firebase for all social events.

## Tech Stack

SheetSolver leverages a robust and modern technology stack to deliver a scalable and responsive user experience.

-   **Frontend:** React Native CLI, React Navigation, Axios, Socket.IO Client
-   **Backend:** Node.js, Express.js, Socket.IO, JWT
-   **Database & Cache:** MySQL, Redis (Upstash)
-   **Cloud & APIs:** Firebase (FCM), Cloudinary, Google Gemini API
-   **Tools:** Git, Postman, VS Code, Docker

## System Architecture

The application is built on a professional three-tier architecture with a dedicated real-time layer and multiple integrated cloud services for scalability and performance.
`Mobile App (React Native) <--> Real-time Server (Node.js/Socket.IO) <--> Database & Cache (MySQL/Redis) <--> Cloud Services`

## Setup & Installation

*(This is a template; you would fill in the details for your specific repository)*

1.  **Clone the repository:** `git clone ...`
2.  **Backend Setup:**
    - `cd backend`
    - `npm install`
    - Set up your `.env` file with credentials for MySQL, Cloudinary, Firebase, Redis, and Gemini.
    - `npm start`
3.  **Frontend Setup:**
    - `cd frontend`
    - `npm install`
    - Set up your `.env` file with the backend server URL.
    - `npx react-native run-android` or `npx react-native run-ios`

## Key Achievements & Learnings

-   **Full-Stack Development:** Architected and developed a complete full-stack application from concept to a polished, functional product as the sole developer.
-   **Real-time Systems:** Mastered Socket.IO for building complex, low-latency, real-time features like live chat and a server-authoritative competitive game mode.
-   **Professional Authentication:** Implemented an industry-standard JWT authentication system with Access and Refresh tokens for seamless and secure user sessions.
-   **Performance Optimization:** Applied advanced caching strategies with Redis to significantly reduce database load and improve API response times for data-heavy screens like leaderboards and dashboards.
-   **Complex Bug Resolution:** Successfully diagnosed and resolved a wide range of real-world development challenges, including:
    -   Native Android build failures (Manifest Merging, `reanimated` worklets).
    -   Tricky server-side API errors (`404 Not Found`, `403 Forbidden`).
    -   Frontend state management and race condition bugs leading to `undefined` data in the UI.

## Future Enhancements
-   Implement a "Share to Social Media" feature for achievements and game results.
-   Develop public/private profile settings.
-   Deploy the application to the Google Play Store and Apple App Store.
