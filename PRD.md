## Product Requirements Document: Online Casino Platform

**1. Introduction**

This document outlines the product requirements for a new online casino platform. The platform aims to provide a feature-rich, secure, and engaging online gambling experience, comparable to leading platforms like Stake.com, Roobet.com, Shuffle.com, and Gamdom.com. The backend and admin panel will be developed incorporating several AI models to enhance operations, security, and user experience. The frontend is considered complete. This project prioritizes production-readiness, best practices, scalability, and robust testing.

**2. Goals**

- Develop a secure, scalable, and high-performance backend for the online casino.
- Create a comprehensive admin panel for efficient casino operation, monitoring, and management.
- Implement a wide range of popular house games with a provably fair mechanism.
- Integrate with third-party game aggregators for slots and live dealer games.
- Offer diverse and regionally configurable deposit and withdrawal methods, including cryptocurrencies, credit cards, and gift cards.
- Establish a comprehensive affiliate system to drive marketing and user acquisition.
- Incorporate AI models to improve fraud detection, player experience, and operational efficiency.
- Ensure all components are thoroughly tested (TDD approach) and well-documented.
- Implement CI/CD for continuous development and feedback.

**3. Target Audience**

- **Casino Players:** Individuals seeking a diverse and fair online gambling experience.
- **Casino Operators/Administrators:** Staff responsible for managing casino operations, finances, users, and compliance.
- **Affiliates:** Marketers promoting the casino to earn commissions.

**4. Scope**

**4.1. In-Scope Features:**

- **User Management:**
  - Secure user registration (email/password, social logins - configurable).
  - Login/Logout functionality with session management.
  - Password recovery and Two-Factor Authentication (2FA).
  - User profiles with account details, betting history, and transaction logs.
  - KYC (Know Your Customer) verification process (integration with a 3rd party provider, configurable levels based on region/activity).
  - Self-exclusion and responsible gaming tools.
- **Wallet & Payment System:**
  - Multi-currency wallets (cryptocurrencies, fiat).
  - **Deposits:**
    - Cryptocurrencies (BTC, ETH, LTC, USDT, others - configurable). Integration with crypto payment gateways.
    - Credit/Debit Cards (Visa, Mastercard via PSPs like Stripe, Nuvei - region dependent).
    - Gift Cards (integration with relevant providers).
    - Region/country-specific availability of deposit methods, configurable in the admin panel.
  - **Withdrawals:**
    - Cryptocurrencies (to user’s external wallet).
    - Fiat (bank transfers, other methods - region dependent, requiring robust approval workflows).
    - Region/country-specific availability of withdrawal methods.
    - Admin approval workflow for withdrawals, especially fiat.
  - Transaction history for all deposits, withdrawals, bets, and winnings.
  - Internal fund transfers (e.g., between main wallet and specific game wallet, if applicable).
- **House Games (All with Provably Fair mechanism):**
  - Plinko
  - Crash
  - Mines
  - Roulette (European/American - configurable)
  - Blackjack (configurable rules, e.g., number of decks, dealer hits on soft 17)
  - Dice
  - Coinflip (Player vs. Player and Player vs. House)
  - War (Casino War)
  - Poker (e.g., Casino Hold’em against the house)
  - Baccarat
  - _Provably Fair System:_ User-provided client seed, server seed (hashed and revealed post-game), nonce. Ability for players to verify game outcomes.
- **Third-Party Game Integration:**
  - Integration with a game aggregator (e.g., SoftSwiss, EveryMatrix, Slotegrator) for:
    - Slots from various providers.
    - Live dealer games (Blackjack, Roulette, Baccarat, Game Shows).
  - Seamless wallet integration for betting on third-party games.
  - Admin ability to enable/disable specific games or providers.
- **Affiliate System:**
  - Affiliate registration and approval process.
  - Unique tracking links/codes for affiliates.
  - Tiered commission structures (e.g., revenue share, CPA - configurable).
  - Affiliate dashboard: statistics (clicks, registrations, FTDs, revenue generated), earnings, marketing materials.
  - Admin panel for managing affiliates, payouts, and commission structures.
- **Admin Panel (Comprehensive Dashboard & Management Tools):**
  - **Dashboard:**
    - Key Performance Indicators (KPIs): Active users, new registrations, total deposits, total withdrawals, total bets, GGR (Gross Gaming Revenue), NGR (Net Gaming Revenue).
    - Real-time activity overview.
    - Affiliate performance summary.
    - Configurable reporting periods and data visualization.
  - **User Management:**
    - View/search user list.
    - View user details (profile, wallet balances, game history, transaction history, KYC status).
    - Edit user information (with audit trail).
    - Suspend/ban users.
    - Manage user roles and permissions (if applicable beyond player).
    - Manual credit/debit to user accounts (with mandatory reason and audit trail).
  - **Game Management:**
    - Enable/disable house games and third-party games/providers.
    - Configure game settings (e.g., min/max bets, RTP for house games within legal limits, table limits).
    - View game statistics (popularity, revenue, RTP performance).
    - Manage provably fair server seeds.
  - **Payment & Financial Management:**
    - View and manage deposit/withdrawal requests.
    - Manual approval/rejection of withdrawals (especially fiat and large crypto amounts).
    - Configure available deposit/withdrawal methods per region/country.
    - Set transaction limits.
    - View transaction logs with filtering and search.
    - Manage payment gateway configurations.
  - **Affiliate Management:**
    - Approve/reject affiliate applications.
    - Manage affiliate accounts, commission structures, and payout rules.
    - Track affiliate performance and process payouts.
  - **Risk Management & Compliance:**
    - Tools for monitoring suspicious activities (linked to AI fraud detection).
    - Manage KYC verification process and documentation.
    - Reporting tools for regulatory compliance.
  - **Content Management:**
    - Basic CMS for promotional banners, news, FAQ content (if not handled by frontend).
  - **System Configuration:**
    - Site settings (name, logo, maintenance mode).
    - Email template management.
    - Security settings.
- **AI Model Integration:**
  - **Fraud Detection System:** AI to analyze transaction patterns, betting behavior, IP/device anomalies, and bonus abuse to flag suspicious accounts/activities.
  - **Personalized Recommendations (Admin Panel):** AI to suggest potentially high-value player segments for targeted promotions or identify at-risk players for proactive engagement (visible to admin).
  - **Admin Panel Analytics Enhancement:** AI-powered insights on the admin dashboard, highlighting trends, anomalies, and actionable intelligence from casino data.
- **Backend Development & Extension:**
  - The AI development agent will analyze the existing backend codebase.
  - Extend and refactor existing code to meet all specified features.
  - Ensure code adheres to best practices for security, scalability, and maintainability.
- **Testing & Quality Assurance:**
  - Unit tests for all backend modules and functions.
  - Integration tests for interconnected components (e.g., wallet and game logic).
  - End-to-end tests simulating user flows.
  - Performance and load testing.
  - Security testing (penetration testing considerations).
  - Adopt Test-Driven Development (TDD) where practical.
- **CI/CD Pipeline:**
  - Automated build, test, and deployment pipeline (e.g., Jenkins, GitLab CI, GitHub Actions).
  - Staging environment for testing before production deployment.
  - Rollback capabilities.
- **Documentation:**
  - Comprehensive API documentation for backend services.
  - Developer documentation for code modules and architecture.
  - Admin panel user manual.
  - Documentation on the provably fair system for transparency.
- **Progress & ToDo Tracking:**
  - Use of a project management tool (e.g., Jira, Trello, Asana) for task tracking, progress monitoring, and backlog management.

**4.2. Out-of-Scope (for initial production version unless specified otherwise):**

- Frontend development (stated as complete).
- Native mobile applications (focus on web platform).
- Sportsbook functionality.
- Live player-to-player poker tables (beyond casino-style poker against the house).

**5. Functional Requirements (Detailed)**

(Functionality listed under “In-Scope Features” section above provides the detailed functional requirements. Each sub-bullet point there can be considered a specific functional requirement.) I will perform some searches to add more detail to specific areas.

**5.1. Provably Fair Mechanism:**
_ The system will use a combination of a server seed, a client seed, and a nonce for each game round.
_ **Server Seed:** Generated by the casino server before the game round. A cryptographic hash (e.g., SHA-256) of this server seed will be shown to the player _before_ they commit to the game (e.g., place a bet). This server seed is bound to the player account, until they change their client seed, in which case this server seed will be reset and hidden again.
_ **Client Seed:** Provided or modified by the player before the game round. The platform will provide a default client seed, but the player should have the option to input their own. This seed would be bound to their account profile.
_ **Nonce:** A number that increments for each game played with the specific seed pair, ensuring uniqueness for each game round.
_ **Outcome Generation:** The game outcome is determined by a cryptographic function combining the server seed, client seed, and nonce. This process must be deterministic.
_ **Verification:** Whenever the player wishes to verify, they can visit their profile to show the server seed. When they show the server seed, that seed no longer gets used, and a new one gets generated and hidden with showing only its hash. The server seed, client seed, and nonce are all bound to the player and when the client seed changes, they all reset as well. The player can then use an on-site or third-party verifier to input the server seed, client seed, and nonce to independently recalculate and verify the game outcome. The platform should provide a clear explanation and, ideally, a verification tool.
_ The cryptographic algorithms used (e.g., for hashing and outcome generation) should be standard and publicly known.
_ Some platforms may store hashes and results on a blockchain for enhanced, immutable verification. This can be a future consideration.

**5.2. Affiliate System - Detailed Features:**
_ **Commission Models:**
_ Revenue Share: Percentage of Net Gaming Revenue (NGR) generated by referred players. Configurable tiers (e.g., % increases with more FTDs or higher revenue).
_ CPA (Cost Per Acquisition): Fixed payment for each player who registers and makes a first-time deposit (FTD) meeting certain criteria.
_ Hybrid Models: Combination of RevShare and CPA.
_ Admin ability to create and assign custom deals to specific affiliates.
_ **Tracking & Reporting:**
_ Unique tracking links and bonus codes for affiliates.
_ Real-time (or near real-time) reporting dashboard for affiliates showing: clicks, registrations, FTDs, depositing players, NGR, commission earned.
_ Detailed player activity reports for affiliates (anonymized where necessary for privacy).
_ Admin panel reporting: overall affiliate program performance, individual affiliate stats, fraud detection (e.g., unusual conversion rates, self-referrals).
_ **Marketing Tools:**
_ Admin interface to upload and manage marketing creatives (banners, landing pages).
_ Affiliates can access and download these creatives.
_ **Payment Processing:**
_ Automated calculation of affiliate commissions.
_ Admin approval for affiliate payouts.
_ Multiple payout methods for affiliates (e.g., crypto, bank transfer - configurable).
_ Affiliates can view payment history and request withdrawals from their dashboard.
_ **Affiliate Management (Admin):**
_ Application review and approval/rejection.
_ Communication tools (e.g., newsletters, direct messages to affiliates).
_ Fraud prevention tools specific to affiliate activities. \* Ability to suspend or terminate affiliate accounts.

**5.3. AI Model Integration - Functional Details:**
_ **Fraud Detection:**
_ Analyze player registration data (IP, device fingerprint, email velocity).
_ Monitor transaction patterns (deposit sources, withdrawal destinations, velocity, amounts).
_ Detect unusual betting patterns (e.g., chip dumping, arbitrage betting if applicable, unusually consistent wins on specific games).
_ Identify bonus abuse (e.g., multiple accounts from same individual/group for bonus farming).
_ Flag account takeovers based on changes in login patterns, device usage, or betting behavior.
_ The AI should provide a risk score and reasons for flagging, for admin review.
_ **Responsible Gaming AI:**
_ Monitor for patterns like increased deposit frequency/amounts, chasing losses, extended play sessions without breaks, betting escalation.
_ Trigger automated alerts to players with links to responsible gaming tools or self-assessment.
_ Provide alerts to admin/support staff for potential manual intervention or outreach for high-risk players.
_ **Personalized Recommendations (Admin Panel):**
_ Identify player segments based on game preferences, betting habits, and spend.
_ Suggest promotions or bonuses tailored to these segments to improve engagement or retention (for admin to action).
_ **Admin Panel Analytics Enhancement:**
_ AI-driven anomaly detection in KPIs (e.g., sudden drop in GGR from a specific game).
_ Predictive analytics for key metrics (e.g., forecast player churn risk).
_ Natural Language Querying (future consideration) for admins to ask data questions.

**5.4. Payment Methods & Regional Configuration:**
_ The system must support a variety of payment types: Credit/Debit Cards (Visa, Mastercard), E-wallets (Skrill, Neteller, PayPal - region dependent), Bank Transfers (SEPA, SWIFT, local transfers), Cryptocurrencies, Prepaid Vouchers/Gift Cards.
_ **Regional Customization:** The admin panel must allow configuration of which payment methods are available/visible/usable based on the player’s country of registration or IP geolocation.
_ This includes setting different deposit/withdrawal limits, fees (if any), and processing times per method and region.
_ Compliance with local regulations regarding payment methods is crucial (e.g., credit card ban for gambling in UK, China’s ban on online gambling affecting payment processing).
_ For crypto, integrate with reliable exchanges or payment processors that handle crypto-to-fiat conversions if needed and manage wallet infrastructure securely.
_ For fiat, integrate with multiple Payment Service Providers (PSPs) to ensure coverage and redundancy.

**6. Non-Functional Requirements**

- **Performance:**
  - Game actions (bet, spin, deal) should have sub-second response times.
  - Wallet operations (deposit confirmation, balance updates, withdrawal requests) processed quickly.
  - System to support [X hundreds/thousands - to be specified based on business expectation] concurrent users without degradation.
  - Admin panel should load data and reports within acceptable timeframes (e.g., <5 seconds for most views).
- **Security:**
  - OWASP Top 10 vulnerabilities must be addressed.
  - Data encryption at rest (e.g., PII, financial data) and in transit (SSL/TLS everywhere).
  - Secure storage of API keys, credentials, and sensitive configuration.
  - Protection against DDoS attacks.
  - Regular security audits and penetration testing (post-development).
  - Robust authentication and authorization mechanisms for all users and services.
  - Secure management of cryptocurrency wallets (cold storage for majority of funds, multi-sig).
- **Scalability:**
  - Architecture designed to scale horizontally (add more servers) and vertically (increase server resources).
  - Database designed for high read/write load and future growth.
  - Microservices architecture is recommended for independent scaling of components.
- **Reliability/Availability:**
  - Target 99.9% uptime for player-facing services.
  - Redundancy for critical components.
  - Automated backups and disaster recovery plan.
- **Maintainability:**
  - Modular code design.
  - Comprehensive documentation (code comments, API docs, architecture diagrams).
  - Adherence to coding standards.
  - Clear logging for debugging and auditing.
- **Compliance & Regulation:**
  - System designed to support requirements of target gambling licenses (e.g., Curacao, MGA - to be specified).
  - KYC/AML processes integrated and configurable.
  - Responsible Gaming features (self-exclusion, deposit limits, session limits, reality checks).
  - Data privacy regulations (e.g., GDPR) to be adhered to based on player jurisdictions.
- **Testability:** (Covered in Test-Driven Development)
- **Usability (Admin Panel):**
  - Intuitive navigation and clear information hierarchy.
  - Efficient workflows for common administrative tasks.
  - Responsive design for use on different screen sizes (desktop primarily).

**7. Technical Requirements**

- **Backend Technology:** The AI agent will analyze the existing backend codebase. The choice of new technologies should be compatible or integrate well with the existing base. The AI should select appropriate technologies if parts are built from scratch.
- **Database:** A mix of SQL (e.g., PostgreSQL) for transactional data and NoSQL (e.g., MongoDB, Redis) for session management, caching, or game logs might be appropriate. Choice depends on scalability and consistency needs.
- **API Design:** RESTful or GraphQL APIs for communication between frontend, backend, and third-party services. APIs must be versioned.
- **Game Aggregator Integration:** Integration via their provided APIs (typically REST or SOAP).
- **Payment Processor Integration:** Integration with APIs of chosen PSPs and crypto payment gateways.
- **Real-time Communication:** WebSockets or similar technology for live game updates and notifications.
- **Infrastructure:** Monolithic single server structure for now with optional multi server database for redundancies in the future. Docker could be suitable for development, but production is ubuntu server with pm2 and nginx preferred.
- **Logging & Monitoring:** Centralized logging (ELK stack, Grafana Loki) and monitoring tools (Prometheus, Grafana, Datadog).

**8. AI Development Agent Specifics**

- The AI agent tasked with development must:
  - Thoroughly analyze the existing backend codebase to understand its architecture, strengths, and weaknesses.
  - Propose a plan for extending and refactoring the existing code, or for new modules where necessary.
  - Write production-quality code with an emphasis on security, performance, and maintainability.
  - Generate unit, integration, and assist in E2E tests for all developed components.
  - Produce comprehensive documentation for the code and systems it builds.
  - Document all progress and findings so context can be preserved throughout the different phases in development.
  - Integrate the specified AI models (Fraud Detection, etc.) into the backend and admin panel, or develop them if that falls within its capabilities and is preferred over third-party AI solutions. This is to be done last and will be using ollama as inference engine to opensource models.

**9. Development Process & Methodology**

- **Agile Methodology:** Iterative development with regular feedback loops.
- **Test-Driven Development (TDD):** Write tests before writing functional code. Ensure high test coverage.
- **Continuous Integration/Continuous Deployment (CI/CD):** Automated pipeline for builds, tests, and deployments to staging and production environments.
- **Version Control:** Git with a clear branching strategy (e.g., Gitflow).
- **Code Reviews:** All code changes must be reviewed by at least one other developer (or a senior AI instance/human supervisor) before merging.
- **Documentation:** Maintain up-to-date documentation throughout the development lifecycle.
- **Tracking:** Use a project management tool (Jira, Asana, Trello, or similar) for managing user stories, tasks, bugs, and tracking progress. Regular sprint planning, reviews, and retrospectives.

**10. Success Metrics**

- **Player Acquisition Rate:** Number of new registered and depositing players.
- **Player Retention Rate:** Percentage of players returning to play.
- **Average Revenue Per User (ARPU).**
- **Gross Gaming Revenue (GGR) & Net Gaming Revenue (NGR).**
- **Affiliate Program Growth:** Number of active affiliates, revenue generated through affiliates.
- **System Uptime & Performance Metrics.**
- **Reduction in Fraudulent Activity:** Measured by AI system flags and manual reviews.
- **Admin Panel Efficiency:** Time taken for admins to perform key tasks.
- **Customer Support Ticket Volume:** (Relating to technical issues or payment queries).

**11. Future Considerations (Post-MVP)**

- Expanded list of cryptocurrencies and payment methods.
- Advanced AI-driven personalization for players (e.g., game recommendations on frontend, dynamic offers).
- Gamification features (leaderboards, achievements, loyalty programs beyond basic points).
- Social features (e.g., public chat, sharing game results).
- Sportsbook integration.
- Native mobile applications.
- Deeper blockchain integration for game logic or payments.
- Advanced BI and data warehousing solution.

This PRD provides a comprehensive foundation. As the AI agent begins development and analyzes the existing code, further clarifications or adjustments may be needed. Regular communication and feedback will be key.
