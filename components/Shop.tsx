import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useRootState } from 'src/app/hooks/useRootState';
import { useAdaState } from 'src/app/hooks/useAdaState';
import { usePVC } from 'src/app/pvc/v3';

import AdaEvent from 'src/app/event/eventType/adaEvent';
import { AdaEventListener, IRemoveEventListener } from 'app/event';
import { getShopInfos, IShopInfo } from 'app/data/custom';
import { parsingPartsItemDatas } from 'src/app/data/custom/partsItems';
import { SoundTouch } from 'util/sound';
import { NavController } from 'framework/router';
import { EventTrackingId, ProductType, ShopType, WIDataFixedCharge, WIDataFree, WIDataPackage } from 'src/app/data/content/dataType';
import { initBaseLookBookData } from 'src/app/data/custom/lookBook';
import { ShopDataManager } from 'src/app/data/content/Shop';
import { SkinType } from 'src/app/component/Header/v2';
import { isIos } from 'src/env';
import { BuildType, buildType, lang } from 'src/env/urlParam';
import { get } from 'src/localize';

import Header from 'app/component/Header/v2/type/MoneyShopHeader';
import MoneyShopTab from './components/MoneyShopTab';
import PromotionPage from './components/PromotionPage';
import PackagePage from './components/PackagePage';
import CardPage from './components/CardPage';
import StampContents from './components/StampContents';
import ErrorView from 'src/app/pvc/comp/error';
import Style from './index.scss';

export enum ItemType {
  PACKAGE,
  CASH,
  GOLD,
  TICKET,
  STAMP,
  PROMOTION,
}

export enum PopupStatus {
  NONE = 0,
  BUY,
  CANCEL,
  SCARCE,
  FAIL,
  SUCCESS, // POPUP_COMMON_TEXT_BUYCOMPLETE 이거 토스트로 뿌려줌.
}

interface IProps {
  dia?: number;
  gold?: number;
  ticket?: number;
  stamp?: number;
  shopData?: ShopDataManager;
  currentTab?: ItemType;
  fromUnity?: boolean;
}

interface IState {
  receiveFreeReward: {
    receiveFreeCoin: number[];
    receiveFreeDia: number[];
    receiveFreeTicket: number[];
  };

  receivedPackage: WIDataPackage[];
  receivedfixedCharge: WIDataFixedCharge[];

  shopInfo: IShopInfo[];
  cashList: IShopInfo[];
  goldList: IShopInfo[];
  ticketList: IShopInfo[];
  packageList: IShopInfo[];
  promotionList: IShopInfo[];
  currentTab: ItemType;
  popupStatus: PopupStatus;

  ready: boolean;
  errorScreen?: { [key: string]: () => void };
}

export default React.forwardRef((props: IProps, ref) => {
  const {
    constructor,
    ADARouter,
    render,
    setOption,
    getBodyScrollView,
    routeWillFocusIn,
    routeWillFocusOut,
    elementRefs,
    getPageScreenRect,
    visiblePageRender,
    showPageRender,
    visibleStaticUI,
  } = usePVC(props, ref);

  const { rootState, dispatch, actions } = useRootState();

  const shopData = rootState.dataManager as ShopDataManager;
  const modalRef = React.createRef<HTMLDivElement>();
  const moneyShopCallPageName = useRef<string>('');
  const eventList = useRef<IRemoveEventListener[]>([]);

  const refMount = useRef({
    0: false,
    1: false,
    2: false,
    3: false,
    4: false,
    5: false,
  });

  const [state, setState] = useAdaState<IState>({
    receiveFreeReward: {
      receiveFreeCoin: [],
      receiveFreeDia: [],
      receiveFreeTicket: [],
    },

    receivedPackage: [],
    receivedfixedCharge: [],

    popupStatus: PopupStatus.NONE,
    shopInfo: [],
    cashList: [],
    goldList: [],
    ticketList: [],
    packageList: [],
    promotionList: [],
    currentTab: props.currentTab ? props.currentTab : ItemType.PROMOTION,

    ready: false,
    errorScreen: {},
  });

  constructor(() => {
    setOption({
      allowFooterArea: false,
      allowHeaderArea: true,
      whiteSkin: true,
      preventScrollChaining: false,
    });
  });

  useEffect(() => {
    initData();

    getBodyScrollView().style.scrollBehavior = 'auto';
    getBodyScrollView().style.overflow = 'hidden';

    moneyShopCallPageName.current = getMoneyShopCallPage();

    shopData && shopData.getDispatcher().sendFireBasePageEvent({
      eventId: 'shop_mianpage',
      eventParam: [`${moneyShopCallPageName.current}`],
    });

    eventList.current.push(
      new AdaEventListener(AdaEvent.onChangeFree, (data: any) => onUpdateFree(data)).listen(),
      new AdaEventListener(AdaEvent.onPurchaseShopPackage, onPurchasePackage).listen(),
      new AdaEventListener(AdaEvent.onPurchaseShopFixedCharge, onPurchaseShopFixedCharge).listen(),
      new AdaEventListener(AdaEvent.onRefreshShopPackage, onRefreshReceivedPackage).listen(),
      new AdaEventListener(AdaEvent.onRefreshShopFixedCharge, onRefreshFixedCharge).listen(),
    );

    return () => {
      eventList.current.forEach((event) => event.remove());
      shopData && shopData.getDispatcher().showBlackScreen({ isActive: false });
    };
  }, []);

  useEffect(() => {
    // const tabType: number = state.current.currentTab;
    // let tab: number = 0;
    // switch (tabType) {
    //   case ItemType.PACKAGE: tab = ProductType.PACKAGE; break;
    //   case ItemType.CASH: tab = ProductType.CASH; break;
    //   case ItemType.GOLD: tab = ProductType.GOLD; break;
    //   case ItemType.TICKET: tab = ProductType.TICKET; break;
    //   case ItemType.STAMP: tab = ProductType.STAMP; break;
    //   case ItemType.PROMOTION: tab = ProductType.PROMOTION; break;
    //   default: tab = ProductType.PROMOTION; break;
    // }

    state.current.ready && sendFirebasePageEvent(state.current.currentTab);
  }, [state.current.ready, state.current.currentTab]);

  const initData = async () => {
    await initBaseLookBookData();

    const { fromUnity } = props;

    let totalStampBalance = 0;
    let currentTab: ItemType = props.currentTab ? props.currentTab : ItemType.PROMOTION;

    const resShopInfo = await getShopInfos();
    const receivedPackage = shopData && shopData.getParamData().getReceivedPackage().package;
    const receivedfixedCharge = shopData && shopData.getParamData().getReceivedFixedCharge().fixedCharge;

    const filteredShopInfo = resShopInfo.filter((data) => data.display);
    const shopInfo = joinShopDataWithInAppProduct(filteredShopInfo);

    // const packageList: IShopInfo[] = getFilteredPackageList(shopInfo, receivedPackage);
    const packageList: IShopInfo[] = [];
    const promotionList: IShopInfo[] = [];
    const cashList: IShopInfo[] = [];
    const goldList: IShopInfo[] = [];
    const ticketList: IShopInfo[] = [];

    shopInfo
      .sort((itemA, itemB) => itemA.priority - itemB.priority)
      .forEach((item) => {
        if (item.shopMenu === 'PROMOTION') {
          promotionList.push(item);
        }
        else if (item.shopMenu === 'PACKAGE') {
          packageList.push(item);
        }
        else if (item.rewardType === 'Cash') {
          cashList.push(item);
        }
        else if (item.rewardType === 'Gold') {
          goldList.push(item);
        }
        else if (item.rewardType === 'Ticket') {
          ticketList.push(item);
        }
      });

    if (shopData) {
      rootState.stampBalance.forEach((data) => totalStampBalance += data.value);

      if (fromUnity) {
        const tabType: number = shopData.getParamData().getActiveTab().activeTab;
        let tab: number = 5;
        switch (tabType) {
          case ProductType.PACKAGE: tab = ItemType.PACKAGE; break;
          case ProductType.CASH: tab = ItemType.CASH; break;
          case ProductType.GOLD: tab = ItemType.GOLD; break;
          case ProductType.TICKET: tab = ItemType.TICKET; break;
          case ProductType.STAMP: tab = ItemType.STAMP; break;
          case ProductType.PROMOTION: tab = ItemType.PROMOTION; break;
          default: tab = ItemType.PROMOTION; break;
        }
        currentTab = tab;
      }

      calcFree(shopInfo);
    }

    refMount.current[currentTab] = true;

    setState({
      ...state.current,
      shopInfo,
      cashList,
      goldList,
      ticketList,
      packageList,
      promotionList,
      currentTab,
      receivedPackage,
      receivedfixedCharge,
      ready: true,
    });
  };

  const sendFirebasePageEvent = (currentTab: ItemType) => {
    let eventId: string;

    switch (currentTab) {
      case ItemType.PACKAGE: eventId = EventTrackingId.shop_pack_page; break;
      case ItemType.CASH: eventId = EventTrackingId.shop_dia_page; break;
      case ItemType.GOLD: eventId = EventTrackingId.shop_coin_page; break;
      case ItemType.TICKET: eventId = EventTrackingId.shop_ticket_page; break;
      case ItemType.STAMP: eventId = EventTrackingId.shop_stamp_page; break;
      case ItemType.PROMOTION: eventId = EventTrackingId.shop_promotion_page_view; break;
      default: eventId = EventTrackingId.shop_promotion_page_view; break;
    }

    shopData && shopData.getDispatcher().sendFireBasePageEvent({
      eventId,
      // eventParam: [`${moneyShopCallPageName}`],
    });

    shopData && shopData.getDispatcher().sendEventCustomView({
      eventId,
      // eventParam: [`${moneyShopCallPageName}`],
    });
  };

  const getFilteredPackageList = (shopInfo: IShopInfo[], receivedPackage: WIDataPackage[]) => {
    const packageList: IShopInfo[] = shopInfo
      .filter((item: IShopInfo) => {
        // 타입 필터링
        if (item.shopMenu !== 'PACKAGE') {
          return false;
        }

        // 기간 한정 상품 필터링
        if (item.shopType === ShopType.TIMELIMIT) {
          const startTime = Date.parse(item.saleStart);
          const endTime = Date.parse(item.saleEnd);
          const now = Date.now();

          if (startTime > now || endTime < now) {
            return false;
          }
        }
        else if (item.shopType === ShopType.CONNECTED) {
          // 최대 구매 수량 도달 필터링
          if (item.goodsLimit !== 0) {
            const findReceivedPackage = receivedPackage.find((packageData) => packageData.id === item.id);

            if (findReceivedPackage && findReceivedPackage.count >= item.goodsLimit) {
              return false;
            }
          }
        }

        // 구매 가능 조건 미충족 필터링
        if (item.prevId) {
          const targetPackage = shopInfo.find((data) => data.id === item.prevId);
          const findReceivedPackage = receivedPackage.find((packageData) => packageData.id === item.prevId);

          if (targetPackage) {
            if (!findReceivedPackage || targetPackage.goodsLimit > findReceivedPackage.count) {
              return false;
            }
          }
        }

        return true;
      })
      .sort((itemA: any, itemB: any) => itemA.priority - itemB.priority);

    return packageList;
  };

  const joinShopDataWithInAppProduct = (data: IShopInfo[]) => {
    const { products } = shopData.getParamData().getInAppProductList();

    const joinedData = data.map((shopInfo) => {
      let localizedPriceString = null;
      let isoCurrencyCode = null;
      let productId = null;

      if (shopInfo.priceType === 'RealMoney') {
        const matchId = isIos ? shopInfo.iosItem : shopInfo.aosItem;
        const findProduct = products.find((product) => product.productID === matchId);

        if (buildType === BuildType.BUILD_CN && !isIos) {
          localizedPriceString = `¥ ${shopInfo.priceCny}`;
          productId = matchId;
        }
        else {
          if (findProduct) {
            localizedPriceString = findProduct.localizedPriceString;
            isoCurrencyCode = findProduct.isoCurrencyCode;
            productId = findProduct.productID;
          }
          else {
            const price = (
              lang === 'ko' && shopInfo.priceKr ||
              lang === 'cn' && shopInfo.priceCny ||
              shopInfo.priceUsd
            );

            localizedPriceString = `${get('UI_COMMON_TEXT_CURRENCYUNIT')} ${price}`;
            productId = matchId;
          }
        }
      }

      return {
        ...shopInfo,
        localizedPriceString,
        isoCurrencyCode,
        productId,
      };
    });

    return joinedData;
  };

  const calcFree = (shopInfo: IShopInfo[]) => {
    const receiveFreeReward: IState['receiveFreeReward'] = {
      receiveFreeCoin: [],
      receiveFreeDia: [],
      receiveFreeTicket: [],
    };

    const timeFree = shopData.getParamData().getReceivedFreeInShop().timefree;
    const timeFreeItems = shopInfo.filter((shop: IShopInfo) => shop.priceType === 'TIME_FREE');

    const freeGoldObj = timeFreeItems.find((shop: IShopInfo) => shop.rewardType === 'Gold');
    const freeDiaObj = timeFreeItems.find((shop: IShopInfo) => shop.rewardType === 'Cash');
    const freeTicketObj = timeFreeItems.find((shop: IShopInfo) => shop.rewardType === 'Ticket');

    freeGoldObj && receiveFreeReward.receiveFreeCoin.push(freeGoldObj.id);
    freeDiaObj && receiveFreeReward.receiveFreeDia.push(freeDiaObj.id);
    freeTicketObj && receiveFreeReward.receiveFreeTicket.push(freeTicketObj.id);

    if (timeFree.length > 0) {
      timeFree.forEach((free: WIDataFree) => {
        if (freeGoldObj && freeGoldObj.id === free.id && calcReceiveFree(free.time)) {
          receiveFreeReward.receiveFreeCoin = [];
        }
        if (freeDiaObj && freeDiaObj.id === free.id && calcReceiveFree(free.time)) {
          receiveFreeReward.receiveFreeDia = [];
        }
        if (freeTicketObj && freeTicketObj.id === free.id && calcReceiveFree(free.time)) {
          receiveFreeReward.receiveFreeTicket = [];
        }
      });
    }

    setState({
      ...state.current,
      receiveFreeReward,
    });
  };

  const cbRefreshFree = () => {
    calcFree(state.current.shopInfo);
  };

  const calcReceiveFree = (timeStamp: number) => {
    if (timeStamp === 0) {
      return false; // 안받은거
    }
    else {
      const year = new Date().getUTCFullYear();
      const month = new Date().getUTCMonth();
      const date = new Date().getUTCDate();

      const startTime = Date.UTC(year, month, date, 0, 0, 0, 0);
      const endTime = Date.UTC(year, month, date, 23, 59, 59, 999);

      if (startTime < timeStamp && timeStamp < endTime) {
        return true; // 받은거
      }
      return false; // 안받은거
    }
  };

  const onUpdateFree = (data: { id: number, rewardType: string, cash?: number, gold?: number, ticket?: number }) => {
    if (data.rewardType === 'Cash') {
      setState({
        ...state.current,
        receiveFreeReward: {
          ...state.current.receiveFreeReward,
          receiveFreeDia: state.current.receiveFreeReward.receiveFreeDia.filter((id: number) => id !== data.id),
        },
      });
    }
    if (data.rewardType === 'Gold') {
      setState({
        ...state.current,
        receiveFreeReward: {
          ...state.current.receiveFreeReward,
          receiveFreeCoin: state.current.receiveFreeReward.receiveFreeCoin.filter((id: number) => id !== data.id),
        },
      });
    }
    if (data.rewardType === 'Ticket') {
      setState({
        ...state.current,
        receiveFreeReward: {
          ...state.current.receiveFreeReward,
          receiveFreeTicket: state.current.receiveFreeReward.receiveFreeTicket.filter((id: number) => id !== data.id),
        },
      });
    }
  };

  const onPurchasePackage = (data: { id: number }) => {
    const receivedPackage = state.current.receivedPackage.concat();
    const findReceivedPackage = receivedPackage.find((packageData) => packageData.id === data.id);

    if (findReceivedPackage) {
      findReceivedPackage.count++;
    }
    else {
      receivedPackage.push({
        id: data.id,
        count: 1,
      });
    }

    const packageList = getFilteredPackageList(state.current.shopInfo, receivedPackage);

    shopData && shopData.getDispatcher().syncReceivedPackage({
      package: receivedPackage,
    });

    shopData && shopData.getParamData().setReceivedPackage({
      package: receivedPackage,
    });

    setState({
      ...state.current,
      receivedPackage,
      packageList,
    });
  };

  const onPurchaseShopFixedCharge = (data: { id: number, time: number }) => {

    let receivedfixedCharge: WIDataFixedCharge[] = [];

    const idx = state.current.receivedfixedCharge.findIndex((f: WIDataFixedCharge) => {
      return f.id === data.id;
    });

    if (idx === -1) {
      receivedfixedCharge = state.current.receivedfixedCharge.concat([{ ...data }]);
    }
    else {
      receivedfixedCharge = state.current.receivedfixedCharge.map((f: WIDataFixedCharge) => {
        if (f.id === data.id) {
          return {
            ...f,
            time: data.time,
          };
        }
        else {
          return f;
        }
      });
    }

    shopData && shopData.getDispatcher().syncReceivedFixedCharge({
      fixedCharge: receivedfixedCharge,
    });

    shopData && shopData.getParamData().setReceivedFixedCharge({
      fixedCharge: receivedfixedCharge,
    });

    setState({
      ...state.current,
      receivedfixedCharge,
    });
  };

  const onRefreshReceivedPackage = (res: { data: WIDataPackage[] }) => {
    setState({
      ...state.current,
      receivedPackage: res.data,
    });
  };

  const onRefreshFixedCharge = (res: { data: WIDataFixedCharge[] }) => {
    setState({
      ...state.current,
      receivedfixedCharge: res.data,
    });
  };

  const getMoneyShopCallPage = () => {
    try {
      const history = NavController.history;
      if (history.length <= 1) {
        return '';
      }

      const callPage: string = history[history.length - 2].path;

      const pageName = callPage.slice(1)
        .split('_')
        .map((str) => str[0].toLocaleUpperCase() + str.slice(1))
        .join('');

      return pageName;
    }
    catch (error) {
      console.error(error);
      return 'error';
    }
  };

  const cbOnClickTap = (currentTab: ItemType) => {
    SoundTouch();

    if (currentTab === ItemType.PROMOTION) {
      shopData && shopData.getDispatcher().sendFireBaseClickEvent({
        eventId: EventTrackingId.shop_promotion_page_btn,
      });

      shopData && shopData.getDispatcher().sendEventCustom({
        eventId: EventTrackingId.shop_promotion_page_btn,
      });

    }

    refMount.current[currentTab] = true;

    setState({
      ...state.current,
      currentTab,
    });
  };

  const cbChangeTab = (currentTab: ItemType) => {
    refMount.current[currentTab] = true;
    setState({
      ...state.current,
      currentTab,
    });
  };

  const showErrorScreen = (retryFunc: () => void) => {
    const { errorScreen, currentTab } = state.current;

    const errorScreenMap = {
      ...errorScreen,
      [currentTab]: retryFunc,
    };

    setState({
      ...state.current,
      errorScreen: errorScreenMap,
    });
  };

  const renderErrorScreen = () => {
    const { errorScreen, currentTab } = state.current;
    const screenRect = getPageScreenRect();
    const isErrorScreen = errorScreen[currentTab];

    visiblePageRender(!isErrorScreen);

    return ErrorView(screenRect.bodyHeight, { onRetry: onRetryShop });
  };

  const onRetryShop = () => {
    showPageRender();
    visibleStaticUI(true);

    const { errorScreen, currentTab } = state.current;
    const currentRetryFunc = errorScreen[currentTab];
    const errorScreenMap = {
      ...errorScreen,
    };

    currentRetryFunc && currentRetryFunc();
    delete errorScreenMap[currentTab];

    setState({
      ...state.current,
      errorScreen: errorScreenMap,
    });
  };

  const modalRender = () => {
    return <div ref={modalRef} style={state.current.currentTab !== ItemType.STAMP ? { display: 'none' } : {}} />;
  };

  return render({
    pageModal: () =>
      state.current.errorScreen[state.current.currentTab] &&
      renderErrorScreen(),
    modal: modalRender,
    header: () =>
      <Header
        skinType={SkinType.NewWhite}
        currentTab={state.current.currentTab}
        blockNavigate={true}
      >
        <MoneyShopTab
          ready={state.current.ready}
          currentTab={state.current.currentTab}
          cbOnClickTab={cbOnClickTap}
          receiveFreeReward={state.current.receiveFreeReward}
        />
      </Header>,
    page: () => {
      const headerHeight = elementRefs.header.current && elementRefs.header.current.getHeight();

      return (
        state.current.ready &&
        <div className={Style.body}>

          <div style={{
            display: state.current.currentTab === ItemType.PROMOTION ? 'block' : 'none',
            height: `calc(100vh - ${headerHeight}px)`,
            overflowX: 'hidden',
            overflowY: 'scroll',
          }
          }>
            {
              refMount.current[ItemType.PROMOTION] &&
              <PromotionPage
                shopData={shopData}
                promotionList={state.current.promotionList}
                receivedPackage={state.current.receivedPackage}
                receivedfixedCharge={state.current.receivedfixedCharge}
                changeTab={cbChangeTab}
              />
            }
          </div>

          <div style={{
            display: state.current.currentTab === ItemType.PACKAGE ? 'block' : 'none',
            height: `calc(100vh - ${headerHeight}px)`,
            overflowX: 'hidden',
            overflowY: 'scroll',
          }
          }>
            {
              refMount.current[ItemType.PACKAGE] &&
              <PackagePage
                shopData={shopData}
                packageList={state.current.packageList}
                receivedPackage={state.current.receivedPackage}
                moneyShopCallPageName={moneyShopCallPageName.current}
                changeTab={cbChangeTab}
              />
            }
          </div>

          <div style={{
            display: state.current.currentTab === ItemType.CASH ? 'block' : 'none',
            height: `calc(100vh - ${headerHeight}px)`,
            overflowX: 'hidden',
            overflowY: 'scroll',
          }
          }>
            {
              refMount.current[ItemType.CASH] &&
              <CardPage
                dia={rootState.userData.dia}
                changeTab={cbChangeTab}
                shopData={shopData}
                itemType={ItemType.CASH}
                currentTab={state.current.currentTab}
                shopInfolist={state.current.cashList}
                receiveFreeReward={state.current.receiveFreeReward}
                moneyShopCallPageName={moneyShopCallPageName.current}
                cbRefreshFree={cbRefreshFree}
              />
            }
          </div>

          <div style={{
            display: state.current.currentTab === ItemType.GOLD ? 'block' : 'none',
            height: `calc(100vh - ${headerHeight}px)`,
            overflowX: 'hidden',
            overflowY: 'scroll',
          }
          }>
            {
              refMount.current[ItemType.GOLD] &&
              <CardPage
                dia={rootState.userData.dia}
                changeTab={cbChangeTab}
                shopData={shopData}
                itemType={ItemType.GOLD}
                currentTab={state.current.currentTab}
                shopInfolist={state.current.goldList}
                receiveFreeReward={state.current.receiveFreeReward}
                moneyShopCallPageName={moneyShopCallPageName.current}
                cbRefreshFree={cbRefreshFree}
              />
            }
          </div>

          <div style={{
            display: state.current.currentTab === ItemType.TICKET ? 'block' : 'none',
            height: `calc(100vh - ${headerHeight}px)`,
            overflowX: 'hidden',
            overflowY: 'scroll',
          }
          }>
            {
              refMount.current[ItemType.TICKET] &&
              <CardPage
                dia={rootState.userData.dia}
                changeTab={cbChangeTab}
                shopData={shopData}
                itemType={ItemType.TICKET}
                currentTab={state.current.currentTab}
                shopInfolist={state.current.ticketList}
                receiveFreeReward={state.current.receiveFreeReward}
                moneyShopCallPageName={moneyShopCallPageName.current}
                cbRefreshFree={cbRefreshFree}
              />
            }
          </div>

          <div
            ref={React.createRef()}
            style={{
              display: state.current.currentTab === ItemType.STAMP ? 'block' : 'none',
              height: `calc(100vh - ${headerHeight}px)`,
              overflowX: 'hidden',
              overflowY: 'scroll',
            }}
            tabIndex={-1}
          >
            {
              refMount.current[ItemType.STAMP] &&
              <StampContents
                changeTab={cbChangeTab}
                dataManager={shopData}
                modalElement={modalRef}
                showErrorScreen={showErrorScreen}
                moneyShopCallPageName={moneyShopCallPageName.current}
              />
            }
          </div>
        </div>
      );
    },
  });
});
