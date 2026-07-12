.PHONY: help install build build-devices build-runtime run-devices run-runtime clean

# Default target: display help
help:
	@echo "Available commands:"
	@echo "  make install         - Install dependencies for all workspaces"
	@echo "  make build           - Build all workspaces (devices and runtime)"
	@echo "  make build-devices   - Build the devices workspace"
	@echo "  make build-runtime   - Build the runtime workspace"
	@echo "  make run-devices     - Build and run the devices workspace"
	@echo "  make run-runtime     - Build and run the runtime workspace"
	@echo "  make clean           - Remove build artifacts (dist folders)"

install:
	npm install

build-devices:
	npm run build -w devices

build-runtime:
	npm run build -w runtime

build: build-devices build-runtime

run-devices: build-devices
	npm run start -w devices

run-runtime: build-runtime
	npm run start -w runtime

clean:
	rm -rf devices/dist runtime/dist communication/dist services/dist
