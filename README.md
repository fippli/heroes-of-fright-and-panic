# Tower Game

Defend your house in the woods

## PM

- Make critters walk towards the center

## Docker

### Build and Run with Docker

Build the Docker image:

```bash
docker build -t forest-game .
```

Run the container:

```bash
docker run -p 3000:3000 forest-game
```

### Build and Run with Docker Compose

Build and start the service:

```bash
docker-compose up --build
```

Or run in detached mode:

```bash
docker-compose up -d --build
```

Stop the service:

```bash
docker-compose down
```

The application will be available at `http://localhost:3000`
