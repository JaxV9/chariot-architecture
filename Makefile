.PHONY: help install build build-devices build-runtime build-communication build-services run-devices run-runtime run-services demo clean stop-demo

# Default target: display help
help:
	@echo "Available commands:"
	@echo "  make install         - Install dependencies for all workspaces"
	@echo "  make build           - Build all workspaces (devices, runtime, communication, services)"
	@echo "  make build-devices   - Build the devices workspace"
	@echo "  make build-runtime   - Build the runtime workspace"
	@echo "  make build-services  - Build the services workspace"
	@echo "  make run-devices     - Build and run the devices workspace"
	@echo "  make run-runtime     - Build and run the runtime workspace"
	@echo "  make run-services    - Build and run the services workspace (REST API + internal subscriber)"
	@echo "  make demo            - Launch the full end-to-end demo (devices + runtime + services)"
	@echo "  make clean           - Remove build artifacts (dist folders)"

install:
	npm install

build-devices:
	npm run build -w devices

build-runtime:
	npm run build -w runtime 

build-communication:
	npm run build -w communication

build-services: build-communication
	npm run build -w services

build: build-devices build-runtime build-communication build-services

run-devices: build-devices
	npm run start -w devices

run-runtime: build-runtime
	npm run start -w runtime

run-services: build-services
	npm run start -w services

demo: build
	rm -rf ~/.matter
	npx -y concurrently -n "Devices,Runtime,Services" -c "green,blue,cyan" \
		"make run-devices" \
		"sleep 8 && make run-runtime" \
		"sleep 15 && make run-services"

stop-demo:
	@echo "Stopping Chariot demo processes..."
	@pkill -f "run-devices" || true
	@pkill -f "run-runtime" || true
	@pkill -f "run-services" || true
	@pkill -f "dist/index.js --device" || true
	@pkill -f "dist/index.js --runtime" || true
	@pkill -f "services/dist/index.js" || true
	@pkill -f "node.*services" || true
	@pkill -f "runtime/dist/listen.js" || true
	@sleep 1


clean:
	rm -rf devices/dist runtime/dist communication/dist services/dist


