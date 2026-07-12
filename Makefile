.PHONY: help install build build-devices build-runtime run-devices run-runtime run-communication demo clean stop-demo

# Default target: display help
help:
	@echo "Available commands:"
	@echo "  make install         - Install dependencies for all workspaces"
	@echo "  make build           - Build all workspaces (devices and runtime)"
	@echo "  make build-devices   - Build the devices workspace"
	@echo "  make build-runtime   - Build the runtime workspace"
	@echo "  make run-devices     - Build and run the devices workspace"
	@echo "  make run-runtime     - Build and run the runtime workspace"
	@echo "  make run-communication - Build and run the communication middleware"
	@echo "  make demo            - Launch the full end-to-end demo (devices + runtime + communication)"
	@echo "  make clean           - Remove build artifacts (dist folders)"

install:
	npm install

build-devices:
	npm run build -w devices

build-runtime:
	npm run build -w runtime 

build: build-devices build-runtime build-communication

run-devices: build-devices
	npm run start -w devices

run-runtime: build-runtime
	npm run start -w runtime

build-communication:
	npm run build -w communication

run-communication: build-communication
	npm run start -w communication

demo: build build-communication
	rm -rf ~/.matter
	npx -y concurrently -n "Devices,Runtime,Communication" -c "green,blue,magenta" \
		"make run-devices" \
		"sleep 8 && make run-runtime" \
		"sleep 15 && make run-communication"

stop-demo:
	@echo "Stopping Chariot demo processes..."
	@pkill -f "run-devices" || true
	@pkill -f "run-runtime" || true
	@pkill -f "run-communication" || true
	@pkill -f "dist/index.js --device" || true
	@pkill -f "dist/index.js --runtime" || true
	@pkill -f "dist/index.js --communication" || true
	@pkill -f "runtime/dist/listen.js" || true
	@sleep 1


clean:
	rm -rf devices/dist runtime/dist communication/dist services/dist

