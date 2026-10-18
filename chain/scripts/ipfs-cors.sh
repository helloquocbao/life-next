#!/bin/sh
# Cho phép web dev (localhost) gọi HTTP API của Kubo từ trình duyệt.
set -e
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["http://localhost:5190", "http://127.0.0.1:5190"]'
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["POST"]'
ipfs config --json Gateway.HTTPHeaders.Access-Control-Allow-Origin '["*"]'
