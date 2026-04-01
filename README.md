# GPU Monitoring

`gpustat` 출력을 웹 대시보드로 보여주는 Next.js 서버입니다. 기본 포트는 `0.0.0.0:9999`입니다.

## 설치

```bash
cd /home/shimdx/Workspace/gpustat
npm install
sudo ./scripts/gpustat-service.sh install
sudo ./scripts/gpustat-service.sh enable
sudo ./scripts/gpustat-service.sh start
```

설치가 끝나면 부팅 시 자동으로 시작됩니다.

## 사용

서비스 관리:

```bash
sudo ./scripts/gpustat-service.sh start
sudo ./scripts/gpustat-service.sh stop
sudo ./scripts/gpustat-service.sh restart
sudo ./scripts/gpustat-service.sh enable
sudo ./scripts/gpustat-service.sh disable
./scripts/gpustat-service.sh status
./scripts/gpustat-service.sh logs
```

브라우저 접속:

```bash
http://127.0.0.1:9999
```

같은 네트워크 다른 장치에서는 서버 IP 기준으로:

```bash
http://SERVER_IP:9999
```

## 삭제

서비스 제거:

```bash
sudo ./scripts/gpustat-service.sh uninstall
```

프로젝트 파일까지 지우려면:

```bash
rm -rf /home/shimdx/Workspace/gpustat
```

## 참고

- 현재 서비스는 이 환경 호환성 때문에 `next start` 대신 `npm run dev` 기반으로 실행됩니다.
- `gpustat`가 NVIDIA 드라이버를 읽지 못하면 대시보드에 에러가 그대로 표시됩니다.
