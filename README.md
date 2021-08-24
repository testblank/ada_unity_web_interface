# ada_unity_web_interface
---
#### 전 회사에서 사용한 repository가 비공개라 제가 작성한 페이지들 중에 메인 컴포넌트를 올렸습니다.
##### AppStore > https://apps.apple.com/kr/app/%EC%97%90%EC%9D%B4%EB%8B%A4-ada-play/id1543660219
##### PlayStore > https://play.google.com/store/apps/details?id=com.fit.ada
---
### 1. StyleChallege.tsx
![styleChallege](https://user-images.githubusercontent.com/38905668/130555779-7f726907-07c0-4e9c-960e-dbadc3a9e4e9.gif)

>유저들이 올린 룩(하나의 이미지) 중에 마음에 드는 이미지에 투표를 하는 페이지 입니다. 첫 번째 탭에서 현재 진행중 또는 기간이 지난 챌린지를 표시 해 줍니다. 두 번쨰 투표 탭 에서는 투표를 할 수 있습니다. 이미지 선택 또는 draw를 통해 투표가 끝나면 서버에 보상을 요청 합니다.
---
### 2. CollectionMain.tsx
![collectionMain](https://user-images.githubusercontent.com/38905668/130562710-8fd39692-12da-4ad0-af85-8dd4d1779454.gif)

>컬렉션(이미지 모음)을 나열한 페이지 입니다. 각 컬렉션에는 컬렉션의 주제에 맞는 이미지들이 있고 태그나 아이템으로 관련 이미지를 찾아 볼 수 있습니다. 이미지에 포함 된 아이템을 모으면 리워드를 받을 수 있습니다.
---
### 3. LookBook.tsx
![LookBook](https://user-images.githubusercontent.com/38905668/130567695-9e0636a0-5512-424c-ad54-3ac121eb9257.gif)

>서버에서 받은 이미지 배열 sorting 및 infinite scroll기능이 있습니다. 이미지(룩) 클릭 시 detail page로 진입. detail page에는 follow 및 like 버튼이 있고 스와이프업 또는 아이템 버튼을 통해 서랍을 열 수 있습니다. 서랍에서 아이템 클릭 시 item detail page 로 이동. 아이템 구입 및 정보를 볼 수 있습니다. 헤더의 검색 버튼으로는 해시태그를 검색 할 수 있습니다.
---
### 4. Shop.tsx
![shop](https://user-images.githubusercontent.com/38905668/130569542-ac9f40f8-17df-4e49-bfac-fa93c0e13d39.gif)


>현금또는 게임 내 재화로 다른 재화를 구매할 수 있는 페이지 입니다. 무료제공 재화는 획득 후  UTC 00시를 기준으로 타이머가 다 돌면 다시 재화를 획득 할 수 있습니다.
---
### 5. ImageUploader.tsx
gif
>설명
---