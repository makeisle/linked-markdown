# 시작하기

Linked Mark Down(`.lmd`)은 렌더링하면 보이지 않는 두 가지가 더 붙은 마크다운 파일입니다:

1. 문서에 정체성을 부여하는 작은 **YAML 프런트매터** 블록, 그리고
2. 블록을 링크 대상으로 표시하거나 블록 사이에 링크를 거는 작은 **`<!--lmd:… -->` 주석**.

파일 맨 아래의 기계 관리 매니페스트가 UUID, 해석된 링크 그래프, 콘텐츠 해시를 기록합니다. 이건 손으로 쓰지 않습니다 — `lmd build`가 만듭니다.

## CLI 설치

```bash
cargo install --path crates/lmd-cli   # 체크아웃한 저장소에서
# 또는 워크스페이스 빌드
cargo build --release
```

## 첫 문서

```bash
lmd new spec.lmd --title "My spec"
```

```markdown
---
lmd: 1
id: 0192f3a1-7c2e-7b3d-9f10-aa01intro0001
version: 1
title: My spec
---

# My spec <!--lmd:a intro-->

환영합니다. 이 문단 전체가 이제 `intro`라는 이름의 링크 가능한 블록입니다.
```

## 작업 루프

```bash
lmd build spec.lmd   # 매니페스트 (재)생성, 링크 해석, 해시 갱신
lmd check spec.lmd   # 검증: 슬러그 유일성, 끊긴 참조 없음, 알려진 네임스페이스
lmd graph spec.lmd   # 링크 그래프 출력
```

`build`는 반복 실행해도 안전합니다: 이미 본 블록의 UUID는 유지하고 새 슬러그에만 새 UUID를 발급합니다.

## 브라우저에서

같은 코어가 WebAssembly로 컴파일됩니다. `@lmd/core`는 `parse` / `build` / `check` / `serialize`를 제공하고, `@lmd/viewer`는 링크 그래프 오버레이와 함께 문서를 렌더하며, `@lmd/editor`는 편집 중에도 링크 그래프를 유지하는 TipTap WYSIWYG 에디터입니다. **플레이그라운드**가 이 셋을 하나로 엮습니다.

다음: [문법 가이드](/guide/syntax)와 [명세](/guide/spec) (영문).
