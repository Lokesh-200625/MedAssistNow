![Node.js](https://img.shields.io/badge/Backend-Node.js-green)
![MongoDB](https://img.shields.io/badge/Database-MongoDB-brightgreen)
![Redis](https://img.shields.io/badge/Cache-Redis-red)
![RabbitMQ](https://img.shields.io/badge/Messaging-RabbitMQ-orange)
![Elasticsearch](https://img.shields.io/badge/Search-Elasticsearch-yellow)
![Prometheus](https://img.shields.io/badge/Monitoring-Prometheus-blue)
![Grafana](https://img.shields.io/badge/Dashboard-Grafana-purple)

# 🏥 MedAssistNow

A distributed, event-driven backend system that provides real-time medicine availability using caching, asynchronous messaging, search indexing, and observability-first architecture.

# 🚨 Problem Statement

Patients often struggle to find essential medicines during emergencies — especially at night or in remote areas — due to:
Lack of real-time pharmacy stock updates
No centralized availability system
Manual communication delays
No performance monitoring of healthcare systems
A scalable, reliable, and observable system is required to solve this.

# 🎯 Solution Overview

MedAssistNow is a distributed, event-driven platform that:
Provides real-time medicine availability
Enables fast medicine search
Processes orders asynchronously
Maintains high performance using caching
Ensures observability through monitoring dashboards
The system is designed with production-level architecture principles.

# 🧱 System Architecture
Client (Frontend)
        │
        ▼
Backend API (Node.js / Express)
        │
 ┌───────────────┬───────────────┬───────────────┐
 ▼               ▼               ▼               ▼
MongoDB       Redis         RabbitMQ       Elasticsearch
(Database)    (Cache)      (Message Bus)    (Search Engine)
        │
        ▼
Monitoring Layer
(Prometheus + Grafana)

# 🛠 Tech Stack

🌐 Backend
Node.js
Express.js
RESTful API architecture

🗄 Database
MongoDB
Stores users, pharmacies, medicines, and orders
Ensures data persistence and scalability

⚡ Caching Layer
Redis
Fast medicine availability lookups
Reduces database load
Improves API response time

📨 Messaging System
RabbitMQ
Asynchronous order processing
Inventory update events
Decoupled service communication

🔎 Search Engine
Elasticsearch
Fast medicine name search
Fuzzy search capability
High-performance indexing

📊 Monitoring & Observability
Prometheus – Collects system metrics
Grafana – Real-time performance dashboards

🔐 Security
JWT Authentication
Password hashing
Input validation
Protected API routes

## 🧠 Architectural Decisions

### Why Redis?
To reduce read latency and offload MongoDB during high-frequency medicine search queries.

### Why RabbitMQ?
To decouple order processing from the request-response cycle and enable reliable asynchronous inventory updates.

### Why Elasticsearch?
MongoDB text search is limited; Elasticsearch provides fuzzy search and high-performance indexing for medicine lookup.

### Why Prometheus + Grafana?
To monitor API latency, throughput, and service health in real time, ensuring observability-first design.

# 🌟 Core Features

👤 User Features
Register & Login securely
Search medicines instantly
View real-time stock availability
Place medicine orders
Track order status

🏥 Pharmacy Features
Add / Update / Delete medicines
Manage inventory
Process incoming orders

📊 Admin / Monitoring
Live system metrics
API performance tracking
Order processing analytics
System health monitoring

## 🔄 Request Flow

1. User searches medicine.
2. Backend checks Redis cache.
3. If cache miss → Query MongoDB.
4. Search queries handled by Elasticsearch.
5. Orders pushed to RabbitMQ.
6. Consumer processes order & updates inventory.
7. Metrics exported to Prometheus.
8. Grafana visualizes system performance.

# 📡 Sample API Endpoints
Method	Endpoint	Description
POST	/api/auth/register	Register user
POST	/api/auth/login	Login user
GET	/api/medicines	Fetch medicines
POST	/api/orders	Place order
PUT	/api/stock	Update stock
🚀 Installation & Setup
🔹 Prerequisites

## 📈 Scalability Considerations

- Stateless backend services
- Redis caching for horizontal scaling
- Asynchronous order processing
- Independent service containers
- Observability-driven debugging

 ## ⚠ Current Limitations

- Single backend service (not fully microservices)
- No automated CI/CD pipeline
- No horizontal auto-scaling yet

## 🌐 Service Ports

- Backend API → http://localhost:5000  
- Grafana → http://localhost:3000  
- Prometheus → http://localhost:9090  
- Elasticsearch → http://localhost:9200  
- MongoDB → localhost:27017  
- Redis → localhost:6379  
- RabbitMQ → localhost:5672


## 🐳 Docker-Based Setup

This project is fully containerized. No manual installation of services is required.

### Prerequisites
- Docker
- Docker Compose

### Run the System
docker-compose up --build

All services will start automatically.

# 🧠 Engineering Concepts Demonstrated

Distributed system design
Event-driven architecture
Asynchronous processing
Caching strategy implementation
Search indexing optimization
Monitoring & observability
Scalable backend architecture

# 🔮 Future Enhancements

Location-based pharmacy search
SMS / Email order notifications
Kubernetes deployment
Mobile application version

## 💡 Why This Project Matters

This project demonstrates production-level backend engineering by integrating caching, asynchronous messaging, search indexing, and observability into a fully containerized distributed system.
It reflects practical system design thinking beyond CRUD-based applications.

# 👨‍💻 Authors

- Lokesh Nadigoti 
- Zahid Hussain
- Thrivikram
<p>Computer Science Students</p>
<p>Interested in Distributed Systems, Backend Engineering & Machine Learning.</p>
