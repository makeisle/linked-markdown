---
layout: home

hero:
  name: Linked Mark Down
  text: 문서는 곧 그래프
  tagline: 사람에게는 평범한 마크다운으로 읽히고, AI와 도구에게는 타입이 있는 지식 그래프로 읽히는 문서 포맷.
  image:
    src: /logo.svg
    alt: Linked Mark Down
  actions:
    - theme: brand
      text: 지금 써보기
      link: /play/
      target: _self
    - theme: alt
      text: 시작하기
      link: /ko/guide/getting-started
    - theme: alt
      text: 라이브 데모
      link: /ko/guide/demo

features:
  - title: 마크다운처럼 보인다
    details: 모든 링크 메타데이터는 HTML 주석과 프런트매터 안에 있어, 어떤 CommonMark/GFM 렌더러에서도 보이지 않습니다. 원본 파일도 그냥 평범한 프로즈로 읽힙니다.
  - title: 추측이 아니라 정체성
    details: 링크 가능한 모든 블록은 안정적인 UUID를 가집니다. 그 UUID는 외부 벡터 스토어로의 조인 키라, 임베딩은 파일 밖에 두고 파일은 "연결성"의 진실원본으로 남습니다.
  - title: 버전이 있는 링크
    details: 문서 간 참조는 import 락파일(namespace:slug@version)로 해석되고 콘텐츠 해시를 담아, 드리프트를 감지할 수 있습니다.
  - title: 하나의 참조 구현, 두 타깃
    details: Rust 코어가 CLI용 네이티브와 브라우저 에디터·뷰어용 WebAssembly로 컴파일됩니다. 공유 conformance 스위트가 둘의 정합성을 지킵니다.
---
