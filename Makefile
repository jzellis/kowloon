.PHONY: help setup start stop restart logs build clean backup infra

help: ## Show this help message
	@echo "Kowloon Multi-Instance Commands"
	@echo "================================"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Infrastructure commands
infra: ## Start infrastructure (MongoDB, MinIO, Traefik)
	@echo "🚀 Starting infrastructure..."
	@docker compose up -d mongodb minio traefik
	@echo "✅ Infrastructure started"
	@echo "   MongoDB:  mongodb://localhost:27017"
	@echo "   MinIO:    http://localhost:9001"
	@echo "   Traefik:  http://localhost:8080"

infra-stop: ## Stop infrastructure
	@echo "🛑 Stopping infrastructure..."
	@docker compose down
	@echo "✅ Infrastructure stopped"

# Instance management
create: ## Create new instance (Usage: make create DOMAIN=kwln.org)
	@if [ -z "$(DOMAIN)" ]; then \
		echo "❌ Please specify domain: make create DOMAIN=kwln.org"; \
		exit 1; \
	fi
	@./kowloon-instance.sh create $(DOMAIN)

start: ## Start instance(s) (Usage: make start [DOMAIN=kwln.org])
	@./kowloon-instance.sh start $(DOMAIN)

stop: ## Stop instance(s) (Usage: make stop [DOMAIN=kwln.org])
	@./kowloon-instance.sh stop $(DOMAIN)

restart: ## Restart instance(s) (Usage: make restart [DOMAIN=kwln.org])
	@./kowloon-instance.sh restart $(DOMAIN)

list: ## List all instances
	@./kowloon-instance.sh list

info: ## Show instance info (Usage: make info DOMAIN=kwln.org)
	@if [ -z "$(DOMAIN)" ]; then \
		echo "❌ Please specify domain: make info DOMAIN=kwln.org"; \
		exit 1; \
	fi
	@./kowloon-instance.sh info $(DOMAIN)

logs: ## Show logs (Usage: make logs [DOMAIN=kwln.org])
	@./kowloon-instance.sh logs $(DOMAIN)

remove: ## Remove instance (Usage: make remove DOMAIN=kwln.org)
	@if [ -z "$(DOMAIN)" ]; then \
		echo "❌ Please specify domain: make remove DOMAIN=kwln.org"; \
		exit 1; \
	fi
	@./kowloon-instance.sh remove $(DOMAIN)

# Maintenance commands
rebuild: ## Rebuild docker-compose.override.yml
	@./kowloon-instance.sh rebuild

build: ## Rebuild all instances
	@echo "🏗️  Rebuilding all instances..."
	@docker compose build
	@docker compose up -d
	@echo "✅ Build complete"

status: ## Show status of all services
	@docker compose ps

clean: ## Stop and remove all containers and volumes (DELETES DATA!)
	@echo "⚠️  This will DELETE all data!"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker compose down -v; \
		rm -rf instances/*/; \
		echo '{}' > instances/instances.json; \
		rm -f docker-compose.override.yml; \
		echo "✅ Cleaned up"; \
	else \
		echo "❌ Cancelled"; \
	fi

backup: ## Backup database and files
	@echo "💾 Creating backup..."
	@mkdir -p backups
	@docker compose exec -T mongodb mongodump --archive > backups/mongodb-$$(date +%Y%m%d-%H%M%S).archive
	@docker run --rm -v kowloon_minio_data:/data -v $$(pwd)/backups:/backup alpine tar czf /backup/minio-$$(date +%Y%m%d-%H%M%S).tar.gz -C /data .
	@echo "✅ Backup complete in ./backups/"

# Shell access
shell-mongo: ## Open MongoDB shell
	@docker compose exec mongodb mongosh

shell-minio: ## Open MinIO shell
	@docker compose exec minio sh

shell: ## Open shell in instance (Usage: make shell DOMAIN=kwln.org)
	@if [ -z "$(DOMAIN)" ]; then \
		echo "❌ Please specify domain: make shell DOMAIN=kwln.org"; \
		exit 1; \
	fi
	@INSTANCE_ID=$$(./kowloon-instance.sh info $(DOMAIN) 2>/dev/null | grep "^Instance:" | awk '{print $$2}'); \
	CONTAINER=$$(echo $$INSTANCE_ID | tr '_' '-'); \
	docker compose exec kowloon-$$CONTAINER sh
