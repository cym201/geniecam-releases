/**
 * 지니펜 실제 프로그램 동작 웹 시뮬레이터 (최종 완전체)
 * - input_display.py 의 마우스/키보드 실물 규격 (QPainter 1:1)
 * - pencil_cursor.py 의 실제 지니펜 연필 커서 렌더러 (QPainterPath 1:1)
 * - eraser_cursor.py 의 실제 지니펜 레드 원 + 40도 지우개 아이콘 커서 (1:1)
 * - toolbar.py & 판서메뉴 실물 툴바 (업로드 이미지 2와 100% 동일)
 */
(function() {
  'use strict';

  // 13개 툴바 버튼 인덱스 매핑 (실제 toolbar.py 순서)
  // 0:grip, 1:cursor, 2:pen, 3:highlighter, 4:palette, 5:trash(지우개),
  // 6:minus(직선), 7:circle, 8:square, 9:arrow, 10:text, 11:move, 12:settings
  const TOOL_INDICES = {
    grip: 0,
    cursor: 1,
    pen: 2,
    highlighter: 3,
    palette: 4,
    eraser: 5,
    minus: 6,
    circle: 7,
    square: 8,
    arrow: 9,
    text: 10,
    move: 11,
    settings: 12
  };

  // 8대 기능 단계 정의
  const STEPS = [
    {
      id: 'step-basic',
      name: '기본 그리기',
      badge: 'STEP 01 · 기본 그리기',
      title: '판서로 기본 그리기',
      desc: '펜 아이콘을 선택하고 마우스 왼쪽 버튼으로 부드럽게 그릴 수 있습니다.',
      tool: 'pen',
      cursorType: 'pencil',
      color: '#e74c3c',
      duration: 4800,
      run: runBasicDraw
    },
    {
      id: 'step-eraser',
      name: '지우기',
      badge: 'STEP 02 · 지우기',
      title: '스치는 객체 지우개 & 토글 일반 지우개',
      desc: '마우스 오른쪽 버튼을 누르면 객체 지우개로 동작하며, 누른 채 왼쪽 버튼을 딸깍 클릭할 때마다 지우개 모드가 토글로 바뀝니다.',
      tool: 'eraser',
      cursorType: 'eraser',
      color: '#ffffff',
      duration: 5800,
      run: runEraser
    },
    {
      id: 'step-width',
      name: '선 굵기',
      badge: 'STEP 03 · 선 굵기 조절',
      title: '마우스 휠로 굵기 즉시 조절',
      desc: '마우스 휠을 위아래로 움직이면 선의 굵기가 화면에서 바로 조절됩니다.',
      tool: 'pen',
      cursorType: 'pencil',
      color: '#3498db',
      duration: 4800,
      run: runLineWidth
    },
    {
      id: 'step-color',
      name: '선 색상',
      badge: 'STEP 04 · 선 색상 변경',
      title: 'Ctrl + 휠로 색상 즉시 변경',
      desc: 'Ctrl 키를 누른 채 마우스 휠을 돌리면 선의 색상이 순차적으로 바로 바뀝니다.',
      tool: 'palette',
      cursorType: 'pencil',
      color: '#f1c40f',
      duration: 5200,
      run: runLineColor
    },
    {
      id: 'step-menu',
      name: '메뉴변경',
      badge: 'STEP 05 · 도구 메뉴 순환',
      title: 'Alt + 휠로 도구 순환 변경',
      desc: 'Alt 키를 누른 채 마우스 휠을 돌리면 판서 도구가 순차적으로 빠르게 바뀝니다.',
      tool: 'arrow',
      cursorType: 'pencil',
      color: '#2ecc71',
      duration: 5000,
      run: runMenuChange
    },
    {
      id: 'step-snap',
      name: '선 그리기 1 (스냅)',
      badge: 'STEP 06 · 직선·화살표 각도 스냅',
      title: 'Shift 누르면 0°·45°·90° 스냅',
      desc: '직선, 화살표 그리기 할 때 Shift를 누르면 0도, 45도, 90도를 흔들림 없이 정확하게 그릴 수 있습니다.',
      tool: 'arrow',
      cursorType: 'pencil',
      color: '#ff7675',
      duration: 5000,
      run: runSnapLine
    },
    {
      id: 'step-bend',
      name: '선 그리기 2 (꺾기)',
      badge: 'STEP 07 · 꺾은선·꺾은 화살표',
      title: 'Ctrl 누르면 선 중간에서 꺾기',
      desc: '직선, 화살표 그리기 할 때 Ctrl을 누르면 선 중간에서 원하는 각도로 꺾을 수 있습니다.',
      tool: 'arrow',
      cursorType: 'pencil',
      color: '#fdcb6e',
      duration: 5200,
      run: runBendedArrow
    },
    {
      id: 'step-shapes',
      name: '원, 네모 (정형)',
      badge: 'STEP 08 · 정원 및 정사각형',
      title: 'Shift 누르면 정원과 정사각형',
      desc: 'Shift를 누른 채 마우스를 드래그하면 찌그러지지 않는 완벽한 1:1 정원과 정사각형이 그려집니다.',
      tool: 'circle',
      cursorType: 'pencil',
      color: '#00cec9',
      duration: 5000,
      run: runPerfectShapes
    }
  ];

  let currentStepIdx = 0;
  let isPlaying = true;
  let stepStartTime = 0;
  let rafId = null;

  // DOM 캐시
  let canvas, ctx;
  let tabsContainer, infoBadge, infoTitle, infoDesc;
  let keyCtrl, keyShift, keyAlt;
  let mouseBtnLeft, mouseBtnRight, mouseWheel, wheelIndicator;
  let progressFill, btnPlay;
  let toolIndicator, paletteDot;

  // 가상 커서 상태
  const cursor = {
    x: 200,
    y: 200,
    visible: true,
    type: 'pencil', // 'pencil', 'eraser'
    eraserObjectMode: true, // true=획 지우개(차콜), false=부분 지우개(밝은 회색)
    eraserDiameter: 36,
    color: '#e74c3c',
    radius: 4,
    previewRadius: 0
  };

  window.addEventListener('DOMContentLoaded', initSimulator);

  function initSimulator() {
    const container = document.getElementById('gp-simulator');
    if (!container) return;

    canvas = document.getElementById('gp-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    tabsContainer = document.getElementById('gp-sim-tabs');
    infoBadge = document.getElementById('gp-info-badge');
    infoTitle = document.getElementById('gp-info-title');
    infoDesc = document.getElementById('gp-info-desc');

    keyCtrl = document.getElementById('gp-key-ctrl');
    keyShift = document.getElementById('gp-key-shift');
    keyAlt = document.getElementById('gp-key-alt');

    mouseBtnLeft = document.getElementById('gp-mouse-left');
    mouseBtnRight = document.getElementById('gp-mouse-right');
    mouseWheel = document.getElementById('gp-mouse-wheel');
    wheelIndicator = document.getElementById('gp-wheel-indicator');

    progressFill = document.getElementById('gp-progress-fill');
    btnPlay = document.getElementById('gp-btn-play');

    toolIndicator = document.getElementById('gp-tool-indicator');
    paletteDot = document.getElementById('gp-palette-dot');

    // 탭 클릭
    if (tabsContainer) {
      tabsContainer.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = e.target.closest('.gp-sim-tab');
        if (tab && tab.dataset.idx !== undefined) {
          switchStep(parseInt(tab.dataset.idx, 10), false);
        }
      });
    }

    // 마우스 설명 리스트 클릭 연동
    const mouseRows = document.querySelectorAll('.gs-panel:first-child .gs-inputs > div');
    const stepMapping = [0, 1, 2, 3, 4, 5, 6];
    mouseRows.forEach((row, i) => {
      row.style.cursor = 'pointer';
      row.title = '클릭하여 시뮬레이션 확인';
      row.addEventListener('click', () => {
        if (stepMapping[i] !== undefined) {
          switchStep(stepMapping[i]);
/* 사용자가 보는 위치 유지 (강제 점프 방지) */
        }
      });
      row.addEventListener('mouseenter', () => {
        row.style.backgroundColor = 'rgba(231, 76, 60, 0.08)';
      });
      row.addEventListener('mouseleave', () => {
        row.style.backgroundColor = '';
      });
    });

    const btnPrev = document.getElementById('gp-btn-prev');
    const btnNext = document.getElementById('gp-btn-next');
    if (btnPrev) btnPrev.addEventListener('click', () => switchStep((currentStepIdx - 1 + STEPS.length) % STEPS.length));
    if (btnNext) btnNext.addEventListener('click', () => switchStep((currentStepIdx + 1) % STEPS.length));
    if (btnPlay) {
      btnPlay.addEventListener('click', () => {
        isPlaying = !isPlaying;
        updatePlayBtn();
      });
    }

    switchStep(0);
    rafId = requestAnimationFrame(animateLoop);
  }

  function resizeCanvas() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  }

  function updatePlayBtn() {
    if (!btnPlay) return;
    if (isPlaying) {
      btnPlay.innerHTML = '<i class="fa-solid fa-pause"></i> 일시정지';
      btnPlay.classList.add('playing');
    } else {
      btnPlay.innerHTML = '<i class="fa-solid fa-play"></i> 자동재생';
      btnPlay.classList.remove('playing');
    }
  }

  // 브라우저 호환 둥근 사각형 그리기 함수 (roundRect 미지원 브라우저 크래시 원천 차단)
  function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
  // 애니메이션 루프 강제 재가동 (어떤 상황에서도 멈추지 않도록 보장)
  function restartLoop() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    stepStartTime = performance.now();
    rafId = requestAnimationFrame(animateLoop);
  }

  // 스텝 전환 (버튼 클릭 시 항상 0초 처음부터 리셋 및 즉시 재생)
  function switchStep(idx, autoNext = false) {
    currentStepIdx = idx;

    // 사용자가 버튼을 직접 클릭한 경우 무조건 자동 재생 활성화
    if (!autoNext) {
      isPlaying = true;
      updatePlayBtn();
    }

    const cur = STEPS[currentStepIdx];

    // 설명 UI 업데이트
    if (infoBadge) infoBadge.textContent = cur.badge;
    if (infoTitle) infoTitle.textContent = cur.title;
    if (infoDesc) infoDesc.textContent = cur.desc;

    // 탭 하이라이트 업데이트
    if (tabsContainer) {
      const tabs = tabsContainer.querySelectorAll('.gp-sim-tab');
      tabs.forEach((tab, i) => {
        tab.classList.toggle('active', i === currentStepIdx);
      });
      const activeTab = tabs[currentStepIdx];
      if (activeTab && tabsContainer) {
        const tabLeft = activeTab.offsetLeft;
        const tabWidth = activeTab.offsetWidth;
        const containerWidth = tabsContainer.clientWidth;
        tabsContainer.scrollTo({
          left: tabLeft - (containerWidth / 2) + (tabWidth / 2),
          behavior: 'smooth'
        });
      }
    }

    // 프로그레스 바 즉시 0% 리셋
    if (progressFill) {
      progressFill.style.width = '0%';
    }

    // 커서 및 입력 상태 완전 초기화
    cursor.type = cur.cursorType || 'pencil';
    cursor.eraserObjectMode = true;
    cursor.previewRadius = 0;
    setActiveTool(cur.tool);
    setToolColor(cur.color);
    resetInputs();

    // 루프를 즉시 0ms 기준 시간으로 완벽 재시작
    restartLoop();
  }

  // 실제 툴바의 활성화 하이라이트 박스 이동
  function setActiveTool(toolName) {
    const idx = TOOL_INDICES[toolName] !== undefined ? TOOL_INDICES[toolName] : 2;
    if (toolIndicator) {
      const btnW = 35.31;
      const leftPos = Math.round(idx * btnW);
      toolIndicator.style.left = leftPos + 'px';
    }
  }

  // 5번째 팔레트 버튼 우측 하단 실제 컬러 칩 도트 색상 변경
  function setToolColor(colorHex) {
    cursor.color = colorHex;
    if (paletteDot) {
      paletteDot.style.backgroundColor = colorHex;
    }
  }

  function resetInputs() {
    if (keyCtrl) keyCtrl.classList.remove('active');
    if (keyShift) keyShift.classList.remove('active');
    if (keyAlt) keyAlt.classList.remove('active');
    if (mouseBtnLeft) mouseBtnLeft.classList.remove('active');
    if (mouseBtnRight) mouseBtnRight.classList.remove('active');
    if (mouseWheel) mouseWheel.classList.remove('active');
    if (wheelIndicator) {
      wheelIndicator.classList.remove('active');
      wheelIndicator.textContent = '';
    }
    cursor.previewRadius = 0;
  }

  function animateLoop(now) {
    if (!stepStartTime) {
      stepStartTime = now;
    }
    const cur = STEPS[currentStepIdx];
    const elapsed = now - stepStartTime;
    const progress = Math.min(1, elapsed / cur.duration);

    if (progressFill) {
      progressFill.style.width = (progress * 100) + '%';
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    cur.run(progress, elapsed);

    // 커서 그리기 (연필 or 지우개)
    if (cursor.type === 'eraser') {
      drawRealEraserCursor(ctx, cursor.x, cursor.y, cursor.eraserDiameter, cursor.eraserObjectMode);
    } else {
      drawRealPencilCursor(ctx, cursor.x, cursor.y, cursor.color, cursor.previewRadius);
    }

    if (progress >= 1) {
      if (isPlaying) {
        switchStep((currentStepIdx + 1) % STEPS.length, true);
      }
    }

    rafId = requestAnimationFrame(animateLoop);
  }

  function resizeCanvas() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  }

  function updatePlayBtn() {
    if (!btnPlay) return;
    if (isPlaying) {
      btnPlay.innerHTML = '<i class="fa-solid fa-pause"></i> 일시정지';
      btnPlay.classList.add('playing');
    } else {
      btnPlay.innerHTML = '<i class="fa-solid fa-play"></i> 자동재생';
      btnPlay.classList.remove('playing');
    }
  }

  function switchStep(idx) {
    currentStepIdx = idx;
    stepStartTime = performance.now();
    const cur = STEPS[currentStepIdx];

    if (infoBadge) infoBadge.textContent = cur.badge;
    if (infoTitle) infoTitle.textContent = cur.title;
    if (infoDesc) infoDesc.textContent = cur.desc;

    if (tabsContainer) {
      const tabs = tabsContainer.querySelectorAll('.gp-sim-tab');
      tabs.forEach((tab, i) => {
        tab.classList.toggle('active', i === currentStepIdx);
      });
      const activeTab = tabs[currentStepIdx];
      if (activeTab && tabsContainer) {
        const tabLeft = activeTab.offsetLeft;
        const tabWidth = activeTab.offsetWidth;
        const containerWidth = tabsContainer.clientWidth;
        tabsContainer.scrollTo({
          left: tabLeft - (containerWidth / 2) + (tabWidth / 2),
          behavior: 'smooth'
        });
      }
    }

    cursor.type = cur.cursorType || 'pencil';
    cursor.eraserObjectMode = true;
    setActiveTool(cur.tool);
    setToolColor(cur.color);
    resetInputs();
  }

  // 실제 툴바의 활성화 하이라이트 박스 이동
  function setActiveTool(toolName) {
    const idx = TOOL_INDICES[toolName] !== undefined ? TOOL_INDICES[toolName] : 2;
    if (toolIndicator) {
      const btnW = 35.31;
      const leftPos = Math.round(idx * btnW);
      toolIndicator.style.left = leftPos + 'px';
    }
  }

  // 5번째 팔레트 버튼 우측 하단 실제 컬러 칩 도트 색상 변경
  function setToolColor(colorHex) {
    cursor.color = colorHex;
    if (paletteDot) {
      paletteDot.style.backgroundColor = colorHex;
    }
  }

  function resetInputs() {
    if (keyCtrl) keyCtrl.classList.remove('active');
    if (keyShift) keyShift.classList.remove('active');
    if (keyAlt) keyAlt.classList.remove('active');
    if (mouseBtnLeft) mouseBtnLeft.classList.remove('active');
    if (mouseBtnRight) mouseBtnRight.classList.remove('active');
    if (mouseWheel) mouseWheel.classList.remove('active');
    if (wheelIndicator) {
      wheelIndicator.classList.remove('active');
      wheelIndicator.textContent = '';
    }
    cursor.previewRadius = 0;
  }

  function animateLoop(now) {
    if (!stepStartTime) stepStartTime = now;
    const cur = STEPS[currentStepIdx];
    const elapsed = now - stepStartTime;
    const progress = Math.min(1, elapsed / cur.duration);

    if (progressFill) {
      progressFill.style.width = (progress * 100) + '%';
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    cur.run(progress, elapsed);

    // 커서 그리기 (연필 or 지우개)
    if (cursor.type === 'eraser') {
      drawRealEraserCursor(ctx, cursor.x, cursor.y, cursor.eraserDiameter, cursor.eraserObjectMode);
    } else {
      drawRealPencilCursor(ctx, cursor.x, cursor.y, cursor.color, cursor.previewRadius);
    }

    if (progress >= 1) {
      if (isPlaying) {
        switchStep((currentStepIdx + 1) % STEPS.length);
      } else {
        stepStartTime = now - cur.duration;
      }
    }

    rafId = requestAnimationFrame(animateLoop);
  }

  // ========================================================
  // [실제 프로그램 pencil_cursor.py 100% 이식] 연필 커서
  // ========================================================
  function drawRealPencilCursor(ctx, x, y, color, previewRadius) {
    if (!cursor.visible) return;

    ctx.save();

    // 1. 실시간 굵기 프리뷰 원 (마우스 휠 조절 시)
    if (previewRadius > 0) {
      ctx.beginPath();
      ctx.arc(x, y, previewRadius, 0, Math.PI * 2);
      ctx.strokeStyle = '#222222';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fill();
    }

    // 2. 실제 연필 커서 (축을 따라 그린 뒤 45도로 돌림)
    ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 4;
    ctx.translate(x, y);
    ctx.translate(2, 2);
    ctx.rotate(45 * Math.PI / 180);

    const half = 4.8, length = 52, cone = 13, band = 9, lead = 6.5;

    // 외곽선 HALO (흰색 3.6px)
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.lineWidth = 3.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(0.6, 0);
    ctx.lineTo(cone, -half);
    ctx.lineTo(length - 2, -half);
    ctx.quadraticCurveTo(length, -half, length, -half + 2);
    ctx.lineTo(length, half - 2);
    ctx.quadraticCurveTo(length, half, length - 2, half);
    ctx.lineTo(cone, half);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // 차콜 몸통 BODY (#3a3a40)
    ctx.fillStyle = '#3a3a40';
    ctx.fillRect(cone, -half, length - cone - band, half * 2);

    // 꽁무니 색 띠 band (현재 펜 색상)
    ctx.fillStyle = color;
    ctx.fillRect(length - band, -half, band, half * 2);

    // 깎인 나무 목 WOOD (#d9d9de)
    ctx.fillStyle = '#d9d9de';
    ctx.beginPath();
    ctx.moveTo(0.6, 0);
    ctx.lineTo(cone, -half);
    ctx.lineTo(cone, half);
    ctx.closePath();
    ctx.fill();

    // 연필 심 lead (현재 펜 색상)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0.6, 0);
    ctx.lineTo(lead, -half * lead / cone);
    ctx.lineTo(lead, half * lead / cone);
    ctx.closePath();
    ctx.fill();

    // 안쪽 먹선 윤곽선 LINE (#2a2a2e, 1.2px)
    ctx.strokeStyle = '#2a2a2e';
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(0.6, 0);
    ctx.lineTo(cone, -half);
    ctx.lineTo(length - 2, -half);
    ctx.quadraticCurveTo(length, -half, length, -half + 2);
    ctx.lineTo(length, half - 2);
    ctx.quadraticCurveTo(length, half, length - 2, half);
    ctx.lineTo(cone, half);
    ctx.closePath();
    ctx.stroke();

    // 구분선
    ctx.beginPath();
    ctx.moveTo(cone, -half);
    ctx.lineTo(cone, half);
    ctx.moveTo(length - band, -half);
    ctx.lineTo(length - band, half);
    ctx.stroke();

    ctx.restore();
  }

  // ========================================================
  // [실제 프로그램 eraser_cursor.py 100% 이식] 지우개 커서
  // ========================================================
  function drawRealEraserCursor(ctx, x, y, diameter, objectMode) {
    ctx.save();
    ctx.translate(x, y);

    const radius = diameter / 2.0;

    // 1. 바깥 원 (지니캠 레드 #e74c3c + 흰색 테두리 + 어두운 윤곽선)
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#2a2a2e';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 2. 내부 40도 회전 지우개 아이콘
    ctx.save();
    ctx.rotate(40 * Math.PI / 180);
    const scale = diameter / 100.0;
    ctx.scale(scale, scale);

    const topColor = objectMode ? '#3a3a40' : '#d9d9de'; // 획 지우개=차콜 / 일반 지우개=밝은 회색
    const bx = -18, by = -31, bw = 36, bh = 62, br = 6;

    // 전체 흰색 지우개 몸통
    ctx.beginPath();
    drawRoundedRect(ctx, bx, by, bw, bh, br);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // 위쪽 캡 분할 채우기
    ctx.save();
    ctx.beginPath();
    drawRoundedRect(ctx, bx, by, bw, bh, br);
    ctx.clip();
    ctx.fillStyle = topColor;
    ctx.fillRect(-22, -35, 44, 40);
    ctx.restore();

    // 외곽 윤곽선 LINE (#2a2a2e)
    ctx.strokeStyle = '#2a2a2e';
    ctx.lineWidth = Math.max(2.4, 120.0 / diameter);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    drawRoundedRect(ctx, bx, by, bw, bh, br);
    ctx.stroke();

    // 중간 가로선 (-18, 5) ~ (18, 5)
    ctx.beginPath();
    ctx.moveTo(-18, 5);
    ctx.lineTo(18, 5);
    ctx.stroke();

    ctx.restore();

    ctx.restore();
  }

  // ========================================================
  // 8대 기능별 모션 구현
  // ========================================================

  function runBasicDraw(p) {
    const w = canvas.width, h = canvas.height;
    const startX = w * 0.28, startY = h * 0.48;

    if (p < 0.15) {
      cursor.x = startX - 40 * (1 - p / 0.15);
      cursor.y = startY;
      mouseBtnLeft.classList.remove('active');
    } else if (p < 0.85) {
      mouseBtnLeft.classList.add('active');
      const drawP = (p - 0.15) / 0.7;

      ctx.save();
      ctx.strokeStyle = '#e74c3c';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      const points = [
        { x: startX, y: startY },
        { x: startX + 50, y: startY - 30 },
        { x: startX + 110, y: startY + 20 },
        { x: startX + 170, y: startY - 20 },
        { x: startX + 230, y: startY + 15 },
        { x: startX + 280, y: startY - 10 },
        { x: startX + 320, y: startY + 25 }
      ];

      const maxIdx = Math.floor(drawP * (points.length - 1));
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i <= maxIdx; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      if (maxIdx < points.length - 1) {
        const subP = (drawP * (points.length - 1)) - maxIdx;
        const p1 = points[maxIdx], p2 = points[maxIdx + 1];
        const curX = p1.x + (p2.x - p1.x) * subP;
        const curY = p1.y + (p2.y - p1.y) * subP;
        ctx.lineTo(curX, curY);
        cursor.x = curX;
        cursor.y = curY;
      }
      ctx.stroke();

      ctx.font = '600 15px Pretendard';
      ctx.fillStyle = '#6c757d';
      ctx.fillText('마우스 좌클릭으로 실제 연필 필기', startX, startY + 60);

      ctx.restore();
    } else {
      mouseBtnLeft.classList.remove('active');
      ctx.save();
      ctx.strokeStyle = '#e74c3c';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(startX + 50, startY - 30);
      ctx.lineTo(startX + 110, startY + 20);
      ctx.lineTo(startX + 170, startY - 20);
      ctx.lineTo(startX + 230, startY + 15);
      ctx.lineTo(startX + 280, startY - 10);
      ctx.lineTo(startX + 320, startY + 25);
      ctx.stroke();
      ctx.restore();
    }
  }

  function runEraser(p) {
    const w = canvas.width, h = canvas.height;
    const startX = w * 0.28, endX = w * 0.68;
    const line1Y = h * 0.38;
    const line2Y = h * 0.60;

    cursor.type = 'eraser';
    cursor.eraserDiameter = 36;

    ctx.save();
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';

    // ========================================================
    // 1단계: 우클릭 유지 = 객체 지우개 (차콜 캡, 스치면 한 획 즉시 삭제)
    // ========================================================
    if (p < 0.38) {
      cursor.eraserObjectMode = true; // 차콜 캡
      const p1 = p / 0.38;

      // 마우스: 우클릭 ON, 좌클릭 OFF
      mouseBtnRight.classList.add('active');
      mouseBtnLeft.classList.remove('active');

      // 선 1 (파란색)
      if (p1 < 0.5) {
        ctx.strokeStyle = '#3498db';
        ctx.beginPath();
        ctx.moveTo(startX, line1Y);
        ctx.lineTo(endX, line1Y);
        ctx.stroke();
      } else if (p1 < 0.68) {
        // 지워지는 찰나의 점선 잔상
        ctx.strokeStyle = 'rgba(52, 152, 219, 0.35)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(startX, line1Y);
        ctx.lineTo(endX, line1Y);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 선 2 (초록색, 온전히 유지)
      ctx.strokeStyle = '#2ecc71';
      ctx.beginPath();
      ctx.moveTo(startX, line2Y);
      ctx.lineTo(endX, line2Y);
      ctx.stroke();

      // 커서 이동 (위에서 아래로 선 1을 스치고 내려옴)
      cursor.x = startX + 90;
      cursor.y = (line1Y - 45) + p1 * 90;

      // 안내 문구
      ctx.font = '600 15px Pretendard';
      ctx.fillStyle = '#2d3436';
      ctx.fillText('[우클릭 유지] 선을 스치면 한 획 전체가 즉시 삭제 (획 지우개)', startX, line1Y - 22);

      ctx.font = '500 13px Pretendard';
      ctx.fillStyle = '#636e72';
      ctx.fillText('• 캡 색상: 차콜 (객체 지우개 모드)', startX, line1Y - 4);
    }
    // ========================================================
    // 2단계: 우클릭 누른 채 좌클릭 "딸깍!" -> 일반 지우개로 토글 전환!
    // ========================================================
    else if (p < 0.58) {
      const p2 = (p - 0.38) / 0.20;

      // 우클릭은 계속 유지된 상태
      mouseBtnRight.classList.add('active');

      // 커서 위치: 선 2의 앞부분 상단에 위치
      cursor.x = startX + 70;
      cursor.y = line2Y - 15;

      // 좌클릭 "딸깍" (0.20 ~ 0.55 구간에만 잠깐 점등 후 바로 해제!)
      const isClicking = (p2 >= 0.20 && p2 <= 0.55);
      if (isClicking) {
        mouseBtnLeft.classList.add('active');
      } else {
        mouseBtnLeft.classList.remove('active');
      }

      // 딸깍 클릭 시점(p2 >= 0.35)부터 회색 캡(일반 지우개)으로 즉각 토글!
      const isToggled = (p2 >= 0.35);
      cursor.eraserObjectMode = !isToggled; // false면 밝은 회색 캡

      // 선 2 (초록색)
      ctx.strokeStyle = '#2ecc71';
      ctx.beginPath();
      ctx.moveTo(startX, line2Y);
      ctx.lineTo(endX, line2Y);
      ctx.stroke();

      // 토글 순간 시각적 클릭 파동(Ripple Pulse) 효과
      if (p2 >= 0.25 && p2 <= 0.85) {
        const pulseP = (p2 - 0.25) / 0.60;
        const radius = 20 + pulseP * 28;
        const alpha = Math.max(0, 1 - pulseP);
        ctx.save();
        ctx.beginPath();
        ctx.arc(cursor.x, cursor.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(231, 76, 60, ' + alpha * 0.9 + ')';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.restore();
      }

      // 안내 문구 (토글 연출 강조)
      ctx.font = '700 15px Pretendard';
      ctx.fillStyle = '#e74c3c';
      ctx.fillText('★ [우클릭 누른 채 좌클릭 딸깍!] 지우개 모드 토글 전환!', startX, line1Y - 22);

      ctx.font = '500 13px Pretendard';
      ctx.fillStyle = '#2d3436';
      ctx.fillText('누르고 있을 필요 없이, 딸깍 클릭할 때마다 (획 지우개 ↔ 일반 지우개) 전환됩니다.', startX, line1Y - 4);
    }
    // ========================================================
    // 3단계: 토글된 일반 지우개로 원하는 부분만 문질러 지우기 (우클릭만 유지)
    // ========================================================
    else {
      const p3 = (p - 0.58) / 0.42;

      // 마우스: 우클릭 유지, 좌클릭은 누르고 있지 않음(OFF)
      mouseBtnRight.classList.add('active');
      mouseBtnLeft.classList.remove('active');

      cursor.eraserObjectMode = false; // 밝은 회색 캡 (일반 지우개)

      // 지우개로 문지르는 범위
      const scrubStart = startX + 50;
      const scrubMaxDist = (endX - startX) * 0.40;
      const erasedLen = scrubMaxDist * Math.min(1, p3 * 1.35);

      // 선 2: 문지른 부분만 지워지고 양쪽은 남아있는 정밀한 부분 지우개 연출
      ctx.strokeStyle = '#2ecc71';
      // 앞부분 남은 선
      ctx.beginPath();
      ctx.moveTo(startX, line2Y);
      ctx.lineTo(scrubStart, line2Y);
      ctx.stroke();

      // 뒷부분 남은 선
      if (scrubStart + erasedLen < endX) {
        ctx.beginPath();
        ctx.moveTo(scrubStart + erasedLen, line2Y);
        ctx.lineTo(endX, line2Y);
        ctx.stroke();
      }

      // 지우개 커서 좌우 문지르기 모션
      const scrubCycle = Math.sin(p3 * Math.PI * 6);
      cursor.x = scrubStart + erasedLen + scrubCycle * 14;
      cursor.y = line2Y;

      // 안내 문구
      ctx.font = '600 15px Pretendard';
      ctx.fillStyle = '#27ae60';
      ctx.fillText('[토글 후 우클릭 유지] 원하는 부분만 깎아내듯 지우는 일반 지우개', startX, line1Y - 22);

      ctx.font = '500 13px Pretendard';
      ctx.fillStyle = '#636e72';
      ctx.fillText('• 캡 색상: 밝은 회색 (일반 모드) · 다시 좌클릭 딸깍 시 획 지우개로 복귀', startX, line1Y - 4);
    }

    ctx.restore();
  }

  function runLineWidth(p) {
    const w = canvas.width, h = canvas.height;
    cursor.type = 'pencil';
    cursor.x = w * 0.45;
    cursor.y = h * 0.50;

    mouseWheel.classList.add('active');
    wheelIndicator.classList.add('active');

    let currentW = 3;
    if (p < 0.5) {
      wheelIndicator.textContent = '↑';
      currentW = 3 + Math.floor((p / 0.5) * 20);
    } else {
      wheelIndicator.textContent = '↓';
      currentW = 23 - Math.floor(((p - 0.5) / 0.5) * 17);
    }

    cursor.radius = currentW / 2;
    cursor.previewRadius = currentW;

    ctx.save();
    ctx.strokeStyle = '#3498db';
    ctx.lineWidth = currentW;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(w * 0.30, h * 0.50);
    ctx.lineTo(w * 0.42, h * 0.50);
    ctx.stroke();

    ctx.font = '700 16px Pretendard';
    ctx.fillStyle = '#d35400';
    ctx.fillText(`실시간 선 굵기: ${currentW}px`, w * 0.30, h * 0.40);
    ctx.restore();
  }

  function runLineColor(p) {
    const w = canvas.width, h = canvas.height;
    cursor.type = 'pencil';
    cursor.x = w * 0.50;
    cursor.y = h * 0.50;

    keyCtrl.classList.add('active');
    mouseWheel.classList.add('active');
    wheelIndicator.classList.add('active');
    wheelIndicator.textContent = '↑';

    const colors = ['#e74c3c', '#2ecc71', '#3498db', '#f1c40f', '#9b59b6'];
    const colorNames = ['레드', '그린', '스카이블루', '옐로우', '퍼플'];
    const idx = Math.min(colors.length - 1, Math.floor(p * colors.length));
    const selColor = colors[idx];

    setToolColor(selColor);

    ctx.save();
    colors.forEach((c, i) => {
      const px = w * 0.38 + i * 40;
      const py = h * 0.42;
      ctx.beginPath();
      ctx.arc(px, py, i === idx ? 16 : 10, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();
      if (i === idx) {
        ctx.strokeStyle = '#222222';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    });

    ctx.strokeStyle = selColor;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(w * 0.35, h * 0.58);
    ctx.lineTo(w * 0.65, h * 0.58);
    ctx.stroke();

    ctx.font = '700 16px Pretendard';
    ctx.fillStyle = selColor;
    ctx.fillText(`[Ctrl + 휠] 연필 심과 툴바 컬러 칩 즉시 변경: ${colorNames[idx]}`, w * 0.32, h * 0.32);
    ctx.restore();
  }

  function runMenuChange(p) {
    const w = canvas.width, h = canvas.height;
    cursor.x = w * 0.50;
    cursor.y = h * 0.50;

    keyAlt.classList.add('active');
    mouseWheel.classList.add('active');
    wheelIndicator.classList.add('active');
    wheelIndicator.textContent = '↑';

    const tools = ['pen', 'highlighter', 'minus', 'arrow', 'square', 'circle'];
    const toolNames = ['일반 펜', '형광펜', '직선 도구', '화살표 도구', '사각형 도구', '원 도구'];
    const idx = Math.min(tools.length - 1, Math.floor(p * tools.length));
    const selTool = tools[idx];

    setActiveTool(selTool);

    ctx.save();
    ctx.font = '700 20px Pretendard';
    ctx.fillStyle = '#d63031';
    ctx.textAlign = 'center';
    ctx.fillText(`[Alt + 휠] 판서 메뉴 순환: ${toolNames[idx]}`, w * 0.50, h * 0.50);

    ctx.font = '500 14px Pretendard';
    ctx.fillStyle = '#636e72';
    ctx.fillText('실제 툴바 위에서 하이라이트 박스가 부드럽게 이동합니다.', w * 0.50, h * 0.57);
    ctx.restore();
  }

  function runSnapLine(p) {
    const w = canvas.width, h = canvas.height;
    const originX = w * 0.35, originY = h * 0.60;

    keyShift.classList.add('active');
    mouseBtnLeft.classList.add('active');

    ctx.save();
    ctx.strokeStyle = '#ff7675';
    ctx.fillStyle = '#ff7675';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    if (p > 0.15) {
      drawArrow(ctx, originX, originY, originX + 160, originY);
      ctx.font = '600 13px Pretendard';
      ctx.fillText('0° (수평)', originX + 175, originY + 4);
    }
    if (p > 0.45) {
      drawArrow(ctx, originX, originY, originX + 120, originY - 120);
      ctx.fillText('45° (대각선)', originX + 130, originY - 125);
    }
    if (p > 0.75) {
      drawArrow(ctx, originX, originY, originX, originY - 150);
      ctx.fillText('90° (수직)', originX - 30, originY - 165);
    }

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.arc(originX, originY, 80, -Math.PI / 2, 0);
    ctx.stroke();

    ctx.restore();
  }

  function runBendedArrow(p) {
    const w = canvas.width, h = canvas.height;
    // 판서 영역 중앙에 큼직하게 배치
    const startX = w * 0.24, startY = h * 0.58;
    const bendX = w * 0.50, bendY = h * 0.58; // 중간 꺾임점
    const endX = w * 0.68, endY = h * 0.28;   // 최종 화살촉 끝점

    ctx.save();
    ctx.strokeStyle = '#fdcb6e';
    ctx.fillStyle = '#fdcb6e';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 1단계: 마우스 좌클릭 드래그로 수평선 직진 (0% ~ 35%)
    if (p < 0.35) {
      const p1 = p / 0.35;
      mouseBtnLeft.classList.add('active');
      keyCtrl.classList.remove('active');

      const curX = startX + (bendX - startX) * p1;
      const curY = startY;

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(curX, curY);
      ctx.stroke();

      cursor.x = curX;
      cursor.y = curY;

      ctx.font = '600 14px Pretendard';
      ctx.fillStyle = '#636e72';
      ctx.fillText('1. 마우스 좌클릭 드래그로 수평선 그리기', startX, startY + 36);
    }
    // 2단계: 중간 지점에서 Ctrl 키 톡! 눌러 경유점 등록 (35% ~ 50%)
    else if (p < 0.50) {
      const p2 = (p - 0.35) / 0.15;
      mouseBtnLeft.classList.add('active');
      keyCtrl.classList.add('active'); // Ctrl 키 점등!

      // 1구간 선 끊김 없이 유지
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(bendX, bendY);
      ctx.stroke();

      cursor.x = bendX;
      cursor.y = bendY;

      // 꺾임 순간 은은한 외부 파동 링만 살짝 표시 (선 자체는 절대 가리지 않음)
      ctx.save();
      const ringR = 8 + p2 * 14;
      ctx.strokeStyle = 'rgba(230, 126, 34, ' + (0.8 * (1 - p2)) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(bendX, bendY, ringR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.font = '700 15px Pretendard';
      ctx.fillStyle = '#e67e22';
      ctx.fillText('★ [Ctrl 키 톡!] 꺾임점 등록', bendX - 40, bendY + 36);
    }
    // 3단계: 방향을 대각선으로 틀어 2차 드래그 (50% ~ 85%)
    else if (p < 0.85) {
      const p3 = (p - 0.50) / 0.35;
      mouseBtnLeft.classList.add('active');
      keyCtrl.classList.remove('active');

      const curX = bendX + (endX - bendX) * p3;
      const curY = bendY + (endY - bendY) * p3;

      // [핵심] 단 하나의 패스(moveTo -> lineTo -> lineTo)로 이음매 없이 완벽하게 연결!
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(bendX, bendY);
      ctx.lineTo(curX, curY);
      ctx.stroke();

      // 마우스 끝 화살촉
      drawArrowHead(ctx, bendX, bendY, curX, curY, 13);

      cursor.x = curX;
      cursor.y = curY;

      ctx.font = '600 14px Pretendard';
      ctx.fillStyle = '#636e72';
      ctx.fillText('2. 마우스를 원하는 방향으로 꺾어서 계속 드래그', startX, startY + 36);
    }
    // 4단계: 마우스 좌클릭 해제 ➔ 이음매 없이 완벽하게 이어진 꺾은 화살표 완성! (85% ~ 100%)
    else {
      mouseBtnLeft.classList.remove('active');
      keyCtrl.classList.remove('active');

      // [핵심] 단 하나의 패스로 끊김 없이 매끄럽게 이어진 꺾은 화살표
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(bendX, bendY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      drawArrowHead(ctx, bendX, bendY, endX, endY, 14);

      cursor.x = endX;
      cursor.y = endY;

      ctx.font = '700 15px Pretendard';
      ctx.fillStyle = '#e67e22';
      ctx.fillText('✔ 선이 끊기지 않고 하나로 이어진 깔끔한 꺾은 화살표 완성!', startX, startY + 36);
    }

    ctx.restore();
  }

  function runPerfectShapes(p) {
    const w = canvas.width, h = canvas.height;
    keyShift.classList.add('active');
    mouseBtnLeft.classList.add('active');

    ctx.save();
    ctx.strokeStyle = '#00cec9';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    const pDraw = Math.min(1, p / 0.8);
    const size = 110 * pDraw;

    const rx = w * 0.30, ry = h * 0.38;
    ctx.strokeRect(rx, ry, size, size);

    const cx = w * 0.58 + size / 2, cy = ry + size / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
    ctx.stroke();

    cursor.x = rx + size;
    cursor.y = ry + size;

    if (pDraw >= 1) {
      ctx.font = '600 14px Pretendard';
      ctx.fillStyle = '#0984e3';
      ctx.fillText('정사각형 (1:1)', rx + 15, ry + size + 25);
      ctx.fillText('정원 (1:1)', cx - 25, cy + size / 2 + 25);
    }

    ctx.restore();
  }

  function drawArrow(ctx, x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    drawArrowHead(ctx, x1, y1, x2, y2, 12);
  }

  function drawArrowHead(ctx, x1, y1, x2, y2, headlen) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }

})();
