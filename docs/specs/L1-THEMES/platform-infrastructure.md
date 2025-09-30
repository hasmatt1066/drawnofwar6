# L1-THEME: Platform Infrastructure

## Purpose

The Platform Infrastructure theme owns all foundational technical systems that support the entire Drawn of War application. This includes authentication (post-MVP), API gateway, networking infrastructure, WebSocket management, logging, monitoring, error handling, deployment pipelines, and operational tooling. This theme provides the bedrock upon which all other L1 themes are built, ensuring reliability, observability, and scalability.

This theme is essential because application-level features are only as reliable as their infrastructure. Without proper logging, bugs are impossible to diagnose. Without monitoring, outages go undetected. Without robust networking, battles disconnect. While not player-facing, this theme directly impacts every technical success metric in the L0 Vision (generation speed, match stability, performance).

## Scope

### Included

- **API Gateway & Routing**
  - RESTful API endpoints for all services
  - Request routing to appropriate backend services
  - Rate limiting and quota management
  - Request validation and error handling
  - CORS configuration for web clients

- **WebSocket Infrastructure**
  - WebSocket server for real-time communication
  - Connection pooling and management
  - Heartbeat/ping-pong for connection health
  - Reconnection handling and state restoration
  - Horizontal scaling with session affinity

- **Logging & Observability**
  - Structured logging across all services
  - Log aggregation and search (ELK, CloudWatch, etc.)
  - Performance metrics (latency, throughput, errors)
  - Distributed tracing for request flows
  - Custom business metrics (generation time, match duration)

- **Monitoring & Alerting**
  - System health monitoring (CPU, memory, disk, network)
  - Application performance monitoring (APM)
  - Uptime monitoring and synthetic checks
  - Alert routing (PagerDuty, email, Slack)
  - Incident response coordination

- **Error Handling & Recovery**
  - Global error handlers and standardized error responses
  - Retry logic with exponential backoff
  - Circuit breakers for external dependencies
  - Graceful degradation strategies
  - Dead letter queues for failed jobs

- **Deployment & CI/CD**
  - Automated build and test pipelines
  - Containerization (Docker)
  - Orchestration (Kubernetes, ECS, or Cloud Run)
  - Blue-green or canary deployments
  - Rollback mechanisms

- **Configuration Management**
  - Environment-specific configs (dev, staging, prod)
  - Secrets management (AWS Secrets Manager, Vault)
  - Feature flags for gradual rollouts
  - Hot config reloading without restarts

- **Security Foundation**
  - HTTPS/TLS for all communications
  - API key management for external services
  - DDoS protection (Cloudflare, AWS Shield)
  - Security headers and best practices
  - Vulnerability scanning and patching

- **Authentication & Authorization (Post-MVP)**
  - User authentication (OAuth, email/password)
  - Session management
  - JWT or session tokens
  - Authorization middleware
  - Anonymous session handling for MVP

### Explicitly Excluded

- **User Account System**: No persistent accounts for MVP (post-MVP)
- **Payment Processing**: No monetization infrastructure (post-MVP)
- **Email/SMS Notifications**: No messaging systems (post-MVP)
- **Mobile Push Notifications**: Web-only for MVP (post-MVP)
- **Advanced Security**: No WAF, advanced threat detection for MVP (post-MVP)
- **Multi-Region Deployment**: Single-region for MVP (post-MVP)
- **Compliance Tools**: No GDPR/CCPA automation, audit logs (post-MVP)
- **Admin Dashboard**: No operational UI for MVP (post-MVP)
- **A/B Testing Framework**: No experimentation platform (post-MVP)

## Key User Journeys

These journeys happen transparently behind the scenes:

1. **Standard API Request**: Client sends creature generation request → API Gateway validates request → Routes to Generation Pipeline → Logs request → Returns response → Metrics recorded → All within SLA

2. **WebSocket Connection**: Client connects for battle → WebSocket server accepts → Heartbeat initiated → Battle events stream bidirectionally → Connection drops → Server detects within 5s → Reconnection attempted → State restored → Battle continues

3. **Error Handling**: Generation Pipeline calls PixelLab API → API times out → Retry logic triggers → Second attempt succeeds → User unaware of retry → Logs show retry for debugging

4. **Incident Response**: Generation success rate drops below 90% → Alert triggers → Engineer notified via Slack → Logs reviewed → PixelLab API having issues → Circuit breaker engaged → Users see friendly error → PixelLab recovers → Circuit breaker resets

5. **Deployment**: Developer merges code → CI pipeline runs tests → Docker image built → Deployed to Kubernetes staging → Automated tests pass → Canary deployment to 10% prod traffic → Metrics stable → Rolled out to 100% → Old version terminated

## Technical Architecture

### Components

**API Layer**
- `APIGateway`: Express/Fastify/NestJS API server
- `RouteControllers`: Handlers for each endpoint
- `ValidationMiddleware`: Request schema validation
- `RateLimitMiddleware`: Request throttling
- `ErrorHandler`: Global error catching and formatting

**WebSocket Layer**
- `WebSocketServer`: Socket.io or WS server
- `ConnectionManager`: Tracks active connections
- `HeartbeatMonitor`: Ping-pong health checks
- `SessionAffinityRouter`: Routes reconnections to correct server

**Observability**
- `LoggerService`: Winston/Pino structured logging
- `MetricsCollector`: Prometheus/StatsD metrics
- `TracingService`: OpenTelemetry distributed tracing
- `MonitoringDashboard`: Grafana/CloudWatch dashboards

**Infrastructure**
- `DeploymentScripts`: Kubernetes manifests, Terraform configs
- `CIPipeline`: GitHub Actions, GitLab CI, or CircleCI
- `ConfigManager`: Environment configs and secrets
- `HealthCheckEndpoint`: /health, /ready probes

### Key Technologies

- **Node.js + TypeScript**: Primary backend runtime
- **Express/Fastify/NestJS**: API framework
- **Socket.io**: WebSocket library
- **Docker**: Containerization
- **Kubernetes / ECS / Cloud Run**: Orchestration
- **PostgreSQL + Redis**: Databases (managed by Content Management theme)
- **AWS / GCP / Azure**: Cloud provider
- **CloudFront / Cloudflare**: CDN and DDoS protection
- **Prometheus + Grafana**: Metrics and dashboards
- **ELK Stack / CloudWatch**: Log aggregation
- **OpenTelemetry**: Distributed tracing
- **GitHub Actions**: CI/CD

### Data Model

**Primary Entities**
```typescript
interface APIRequest {
  requestId: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  sessionId?: string;
  userId?: string; // null for MVP
  timestamp: Date;
  responseStatus: number;
  latency: number; // ms
  errorMessage?: string;
}

interface WebSocketConnection {
  connectionId: string;
  sessionId: string;
  playerId?: string; // null for MVP
  connectedAt: Date;
  lastHeartbeatAt: Date;
  serverNode: string; // for horizontal scaling
  status: 'connected' | 'disconnected' | 'reconnecting';
}

interface MetricSnapshot {
  timestamp: Date;
  metricName: string;
  value: number;
  tags: Record<string, string>; // e.g., { endpoint: "/generate", status: "200" }
}

interface ErrorLog {
  errorId: string;
  timestamp: Date;
  severity: 'info' | 'warning' | 'error' | 'critical';
  service: string;
  message: string;
  stackTrace?: string;
  context: Record<string, any>;
}

interface DeploymentRecord {
  deploymentId: string;
  version: string;
  deployedAt: Date;
  deployedBy: string;
  environment: 'dev' | 'staging' | 'prod';
  status: 'deploying' | 'success' | 'rolled_back';
  healthChecksPassed: boolean;
}

interface FeatureFlag {
  flagName: string;
  enabled: boolean;
  rolloutPercentage: number; // 0-100
  enabledFor: string[]; // specific session/user IDs
  description: string;
}
```

**Key Relationships**
- Every application service emits APIRequest, MetricSnapshot, ErrorLog
- WebSocketConnection maps to BattleSession (from Matchmaking theme)
- DeploymentRecord tracks version history for rollback decisions

## Dependencies

### Depends On

- No dependencies (this is the foundational layer)

### Depended On By

- **All L1 Themes**: Every theme relies on infrastructure for API, WebSocket, logging, monitoring

## Key Technical Challenges

1. **WebSocket Horizontal Scaling**: When deploying multiple server instances, reconnecting players must route to the server holding their session state. Requires sticky sessions, shared session store (Redis), or full state replication.

2. **Cost-Effective Monitoring at Scale**: Comprehensive logging and metrics generate massive data volume. Cloud providers charge for log ingestion/storage. Must balance observability depth with budget constraints.

3. **Zero-Downtime Deployments**: Updating servers without disconnecting active battles. Requires graceful shutdowns (stop accepting new connections, drain existing), connection migration, or session pause/resume.

4. **Debugging Distributed Systems**: When generation fails, error could be in API Gateway, Generation Pipeline, PixelLab API, or Redis. Distributed tracing essential but adds complexity and overhead.

5. **Alert Fatigue vs Missing Incidents**: Too many alerts (e.g., every 500 error) leads to ignored notifications. Too few alerts miss critical issues. Requires intelligent alerting thresholds and escalation.

6. **Secret Management Without Exposure**: API keys for PixelLab, AWS, etc. must be secure. Hardcoding in code is insecure, env vars logged accidentally. Requires proper secrets management and rotation.

7. **Development/Production Parity**: Ensuring staging environment accurately represents production to catch bugs before deployment. Resource constraints (staging cheaper than prod) create differences that hide issues.

## Success Criteria

### MVP Definition of Done

- [ ] API Gateway handles 100 concurrent requests without errors
- [ ] All endpoints respond within 2 seconds (P95 latency)
- [ ] WebSocket server maintains 100+ simultaneous connections
- [ ] Heartbeat detects disconnections within 5 seconds
- [ ] Logs centralized and searchable (7-day retention)
- [ ] Metrics dashboard shows key stats (generation time, battle duration, error rate)
- [ ] Alerts trigger for critical issues (API error rate >5%, server CPU >80%)
- [ ] CI/CD pipeline deploys to staging automatically on merge to main
- [ ] Manual approval required for production deployment
- [ ] Rollback to previous version possible within 5 minutes
- [ ] Health check endpoint returns 200 when system healthy
- [ ] HTTPS enforced for all connections
- [ ] Secrets stored in AWS Secrets Manager / GCP Secret Manager (not hardcoded)
- [ ] Error responses standardized with clear messages
- [ ] Rate limiting prevents >100 requests/minute per session

### Exceptional Target (Post-MVP)

- [ ] Multi-region deployment with automatic failover
- [ ] API Gateway handles 10,000+ concurrent requests
- [ ] WebSocket server supports 10,000+ simultaneous connections
- [ ] P95 latency under 500ms for all endpoints
- [ ] Distributed tracing across all services
- [ ] Automated canary deployments with automatic rollback on metric degradation
- [ ] Zero-downtime deployments with connection migration
- [ ] Advanced alerting with anomaly detection (ML-based)
- [ ] Comprehensive admin dashboard for operational visibility
- [ ] A/B testing framework for gradual feature rollouts
- [ ] 99.9% uptime SLA with redundancy and failover
- [ ] GDPR-compliant audit logging and data export

## Open Questions

1. **Cloud Provider Selection**: AWS (broad services), GCP (better Kubernetes), Azure (enterprise focus), or multi-cloud?
2. **Kubernetes Necessity**: Worth Kubernetes complexity for MVP, or simpler managed services (AWS ECS, Cloud Run)?
3. **Monitoring Tool Choice**: Prometheus+Grafana (self-hosted, free), Datadog (powerful, expensive), CloudWatch (native, AWS-only)?
4. **Logging Strategy**: ELK Stack (self-hosted complexity), CloudWatch (vendor lock-in), or third-party (Loggly, Papertrail)?
5. **Deployment Frequency**: Deploy multiple times per day (fast iteration) or weekly (stability)?
6. **Staging Environment Sizing**: Full production parity (expensive) or minimal viable staging (cheaper, less accurate)?
7. **WebSocket Scaling Approach**: Redis pub/sub for session replication, sticky sessions, or stateless with frequent DB checks?
8. **Error Budget Philosophy**: Target 99% uptime (MVP tolerance) or 99.9% (enterprise-grade)?

## L2 Epic Candidates

- **Epic: API Gateway & REST Infrastructure** - Express/Fastify setup, routing, validation, error handling
- **Epic: WebSocket Server & Connection Management** - Socket.io setup, heartbeats, reconnection, scaling
- **Epic: Logging & Metrics Collection** - Winston/Pino setup, log aggregation, Prometheus metrics
- **Epic: Monitoring & Alerting System** - Grafana dashboards, alert rules, PagerDuty integration
- **Epic: CI/CD Pipeline & Deployment** - GitHub Actions, Docker builds, Kubernetes deployments
- **Epic: Security Foundation** - HTTPS, secrets management, DDoS protection, security headers
- **Epic: Configuration & Feature Flags** - Environment configs, secrets, feature flag system
- **Epic: Error Handling & Resilience** - Retry logic, circuit breakers, graceful degradation

---

**Version**: 1.0
**Status**: Ready for L2 Epic Development
**Dependencies Validated**: Yes (no external L1 dependencies)