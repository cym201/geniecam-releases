// Perspective-map the supplied screenshots onto photographed device screens.
// Original captures are unchanged; only the phone browser chrome is outside its viewport.
(() => {
  const scene = document.querySelector('.gc-desk');
  if (!scene) return;
  function perspective(points, width, height) {
    const corners = [[0,0],[width,0],[width,height],[0,height]];
    const rows = [];
    corners.forEach(([x,y],i) => {
      const [u,v] = points[i];
      rows.push([x,y,1,0,0,0,-u*x,-u*y,u]);
      rows.push([0,0,0,x,y,1,-v*x,-v*y,v]);
    });
    for(let col=0;col<8;col++) {
      let pivot=col;
      for(let r=col+1;r<8;r++) if(Math.abs(rows[r][col])>Math.abs(rows[pivot][col])) pivot=r;
      [rows[col],rows[pivot]]=[rows[pivot],rows[col]];
      const divisor=rows[col][col];
      if(Math.abs(divisor)<1e-12) throw new Error('Invalid screen projection');
      for(let c=col;c<9;c++) rows[col][c]/=divisor;
      for(let r=0;r<8;r++) if(r!==col) {
        const factor=rows[r][col];
        for(let c=col;c<9;c++) rows[r][c]-=factor*rows[col][c];
      }
    }
    const [a,b,c,d,e,f,g,h]=rows.map(row=>row[8]);
    return `matrix3d(${a},${d},0,${g},${b},${e},0,${h},0,0,1,0,${c},${f},0,1)`;
  }
  scene.querySelector('.gc-monitor-plane').style.transform = perspective([[753,161],[1480,93],[1478,654],[748,629]],1000,632);
  scene.querySelector('.gc-mobile-plane').style.transform = perspective([[1456,377],[1616,372],[1589,778],[1426,772]],500,868);
  const resize = () => scene.querySelector('.gc-desk-inner').style.transform = `scale(${scene.clientWidth/1672})`;
  new ResizeObserver(resize).observe(scene);
  resize();
})();

// 스마트폰 듀오 및 QR코드 팝업 인터랙션:
// - 마우스 올리거나 터치하면 해당 요소가 맨 앞으로 쑥 올라와 전체 표시
// - 마우스 커서가 벗어나면 자동으로 원래대로 복귀하여 QR코드가 최상단이 됨
document.addEventListener('DOMContentLoaded', () => {
  const container = document.querySelector('.gs-phones');
  if (!container) return;

  const items = container.querySelectorAll('.gs-phone-back, .gs-phone-front, .gs-phone-qr-popup');

  // 모바일 터치 및 클릭 대응
  items.forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      items.forEach(el => el.classList.remove('is-hover-front'));
      item.classList.add('is-hover-front');
    });
  });

  // 컨테이너에서 마우스 커서가 벗어나면 즉시 원래대로 복귀 (QR코드 최상단 자동 복귀)
  container.addEventListener('mouseleave', () => {
    items.forEach(el => el.classList.remove('is-hover-front'));
  });

  // 모바일에서 다른 곳 터치 시 원래대로 복귀
  document.addEventListener('touchstart', (e) => {
    if (!container.contains(e.target)) {
      items.forEach(el => el.classList.remove('is-hover-front'));
    }
  }, { passive: true });
});

// 아바타 & 캠 합성 다이얼로그 상호작용:
// - 설정창 또는 아바타 선택창을 클릭하면 해당 창이 최상단(is-top)으로 솟아오름
// - 마우스가 벗어나거나 외부 터치 시 기본 상태로 부드럽게 복귀
document.addEventListener('DOMContentLoaded', () => {
  const camStage = document.querySelector('.gc-cam-stage');
  if (!camStage) return;

  const dialogs = camStage.querySelectorAll('.gc-cam-dialog');

  dialogs.forEach(dialog => {
    dialog.addEventListener('click', (e) => {
      e.stopPropagation();
      dialogs.forEach(d => d.classList.remove('is-top'));
      dialog.classList.add('is-top');
    });
  });

  camStage.addEventListener('mouseleave', () => {
    dialogs.forEach(d => d.classList.remove('is-top'));
  });

  document.addEventListener('touchstart', (e) => {
    if (!camStage.contains(e.target)) {
      dialogs.forEach(d => d.classList.remove('is-top'));
    }
  }, { passive: true });
});

// 다운로드 버튼: 최신 릴리스의 설치 파일 주소를 받아 누르면 바로 내려받게 함.
// 설치 파일 이름에 버전이 들어가므로 주소를 고정하지 않음 (새 버전을 올려도 웹페이지를 고칠 필요 없음).
// 주소를 받지 못하면 원래 링크(릴리스 페이지)를 그대로 씀
document.addEventListener('DOMContentLoaded', () => {
  const buttons = document.querySelectorAll('a[data-latest-installer]');
  if (!buttons.length) return;
  fetch('https://api.github.com/repos/cym201/geniecam-releases/releases/latest', { headers: { Accept: 'application/vnd.github+json' } })
    .then(response => response.ok ? response.json() : Promise.reject(new Error('HTTP ' + response.status)))
    .then(release => {
      const asset = (release.assets || []).find(a => /^GenieCamPro-Setup-.*\.exe$/i.test(a.name));
      if (!asset) throw new Error('설치 파일 없음');
      buttons.forEach(button => {
        button.href = asset.browser_download_url;
        button.removeAttribute('target');  // 새 탭 없이 바로 내려받음
        button.title = asset.name;
      });
    })
    .catch(error => console.warn('최신 설치 파일 주소를 받지 못해 릴리스 페이지로 연결합니다:', error));
});

// 주소에 #위치가 있으면(예: 지니캠 도움말 버튼의 #manual) 사진·글꼴이 다 온 뒤 그 위치로 한 번 정확히 맞춤.
// 처음 열 때 부드러운 스크롤이 켜져 있으면 로드 도중 시작한 스크롤 애니메이션이 페이지가 길어진 뒤에도
// 이어져 위치가 어긋나므로, 부드러운 스크롤은 위치를 맞춘 다음에 켬 (메뉴로 이동할 때만 부드럽게)
window.addEventListener('load', () => {
  const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (target) target.scrollIntoView({ behavior: 'instant', block: 'start' });
  document.documentElement.classList.add('smooth-scroll');
});
