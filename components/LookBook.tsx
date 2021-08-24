import * as React from 'react';
import * as BPromise from 'bluebird';
import * as AEvent from 'src/app/event';
import * as _ from 'lodash';
import { useEffect, useRef } from 'react';
import { globalUserData } from 'src/app/data/sync/UserData';
import { useAdaState } from 'src/app/hooks/useAdaState';
import { useLookbookState } from 'src/app/hooks/useLookbookState';
import { useRootState } from 'src/app/hooks/useRootState';
import { usePVC } from 'src/app/pvc/v3';

import AdaEvent from 'src/app/event/eventType/adaEvent';
import LookBookApi, { ILookBook } from 'app/api/lookBook/lookBookApi';
import PreventScrollChaining from 'src/app/pvc/misc/PreventScrollChaining';
import ProxyBottomNavi from 'src/app/pvc/v2/ui/ProxyMenuNavi';
import { UserDataManager } from 'app/data/user';
import { EventTrackingId, ICustomEventLog, IFireBaseEvent } from 'app/data/content/dataType';
import { LookBookDataManager } from 'app/data/content/LookBook';
import { initBaseLookBookData, initBaseSyncData, parsingLookBookCollectionListInfo } from 'src/app/data/custom/lookBook';
import { IApiLookBookDiscoverListCommand } from 'src/app/api/lookBook/discoverListApi';
import { setStampBalance, getStampBalance } from 'src/app/data/sync/StampBalance';
import { NOTCH_AREA } from 'src/env/ui';
import { ItemType } from 'app/page/MoneyShop';
import { SoundTouch } from 'src/util/sound';
import { PAGE_ROUTES } from 'app/page/routeInfos';
import { get, loadStringNewsResource } from 'src/localize';

import * as Button from 'app/component/Button';
import Header from 'app/component/Header/v2/type/LookBook';
import InnerPullToRefresh, { AsyncTrigger } from 'src/app/pvc/misc/PullToRefresh/InnerPullToRefresh';
import LookBookDiscover from 'src/app/page/LookBook/components/LookBookDiscover';
import LookBookMy from 'src/app/page/LookBook/components/LookBookMy';
import Style from './index.scss';
import { RunBrandNewsProcess } from 'src/app/data/custom/brandNews/brandNewsProcess';
import { lang } from 'src/env/urlParam';

export enum LOOKBOOK_TAB {
  COLLECTION = 'collection',
  EXPLORE = 'explore',
  MY = 'my',
}

interface IProps {
  lookBookData: LookBookDataManager;
  onClickNavigation?: () => void;
  fromLookEditor?: boolean;
}

interface IState {
  userData: UserDataManager;
  tabType: LOOKBOOK_TAB;
  onLoad?: boolean;
  showAddButton?: boolean;
  refreshTrigger?: number;
  // isPlay?: boolean;
}

export default React.forwardRef((props: IProps, ref) => {
  const {
    constructor,
    setOption,
    getBodyScrollView,
    render,
    routeWillFocusIn,
    showErrorScreen,
    ADARouter,
    elementRefs,
    setAllowPageRender,
    allowPageRender,
  } = usePVC(props, ref);

  const tabRef = useRef<HTMLDivElement>();
  const lookBookRef = useRef<HTMLDivElement>();
  const refDiscover = useRef<HTMLDivElement>();
  const refDiscoverContents = useRef<HTMLDivElement>();
  const underbarRef = useRef<HTMLDivElement>();
  const tabSpanRef = useRef<HTMLDivElement>();

  const discoverCompnent = useRef<JSX.Element>();
  const myContentsCompnent = useRef<JSX.Element>();

  const prevScrollTopMy = useRef<number>();
  const prevScrollTopDiscover = useRef<number>();

  const { rootState, dispatch, actions } = useRootState();
  const { lookbookState, lookbookDispatch, lookbookActions } = useLookbookState();

  const [state, setState] = useAdaState<IState>({
    userData: globalUserData.getManager(),
    tabType: LOOKBOOK_TAB.EXPLORE,
    onLoad: false,
    showAddButton: true,
    // isPlay: true,
  });

  constructor(() => {
    setOption({
      allowHeaderArea: false,
      allowFooterArea: false,
      showBottomNavi: true,
      pullToRefresh: false,
      header: {
        title: '',
      },
      whiteSkin: true,
      preventScrollChaining: false,
      showBottomPadding: false,
    });
  });

  routeWillFocusIn(() => {
    if (props.fromLookEditor && !state.current.onLoad) {
      setState({
        ...state.current,
        tabType: LOOKBOOK_TAB.EXPLORE,
      });

      setAllowPageRender(true);
    }
  });

  useEffect(() => {
    initLookBook();

    if (!ProxyBottomNavi.getInstance().dataManager) {
      ProxyBottomNavi.getInstance().setDataManager(props.lookBookData);
    }

    const log: IFireBaseEvent = { eventId: 'lookbook_mainpage' };
    props.lookBookData.getDispatcher().sendFireBasePageEvent(log);

    props.lookBookData.getDispatcher().onUpdatePageData = (data: any) => {
      rootState.dataManager && rootState.dataManager.getParamData().setParamData(data.param);
      props.lookBookData.getParamData().setParamData(data.param);
      const type = props.lookBookData.getParamData().getNaviType();

      if (type === 'feed') {
        // globalUserData.setDatas(data.param.userInfo);
        props.lookBookData.getDispatcher().sendFireBasePageEvent({ eventId: 'lookbook_mainpage' });

        try {
          const userData = data.param.userInfo;
          const stampBalance = data.param.stamp_balance.list ? data.param.stamp_balance.list : rootState.stampBalance;
          const ownedItems = data.param.owned_item.items ? data.param.owned_item.items.map((item) => Number(item)) : rootState.ownedItems;

          dispatch(
            actions.init({
              userData,
              stampBalance,
              ownedItems,
            }),
          );
        }
        catch (error) {
          console.error(error);
        }
        // initBaseSyncData(props.lookBookData, globalUserData.getManager());
      }
    };

    props.lookBookData.getDispatcher().onRefreshSyncMyLooks = onRefreshSyncMyLooks;

    return () => {
      // getBodyScrollView().addEventListener('scroll', addButtonTriggerMy);
      // refDiscoverContents.current.addEventListener('scroll', addButtonTriggerDiscover);
    };
  }, []);

  useEffect(() => {
    props.fromLookEditor && allowPageRender && initLookBook();
  }, [props.fromLookEditor, allowPageRender]);

  useEffect(() => {
    if (state.current.onLoad) {
      const tab: string = props.lookBookData.getParamData().getFocusTab ? props.lookBookData.getParamData().getFocusTab() : LOOKBOOK_TAB.EXPLORE;

      if (tab == LOOKBOOK_TAB.EXPLORE || tab == LOOKBOOK_TAB.MY) {
        setState({
          ...state.current,
          tabType: tab,
          showAddButton: true,
        });
      }

      // getBodyScrollView().addEventListener('scroll', addButtonTriggerMy, true);
      // refDiscoverContents.current.addEventListener('scroll', addButtonTriggerDiscover, false);
    }
  }, [state.current.onLoad]);

  const initLookBook = async () => {
    const { lookBookData } = props;
    const { userData } = state.current;

    await RunBrandNewsProcess();
    await loadStringNewsResource(lang);

    await initBaseLookBookData(lookBookData, userData);

    try {
      const [
        ,
        lookBookApiData,
      ] = await BPromise.all([
        parsingLookBookCollectionListInfo(),
        callLookBookApi(),
      ]);

      lookbookDispatch(
        lookbookActions.init({
          dataManager: lookBookData,
          bookmarkList: lookBookApiData.bookmarkList,
          completedLookList: lookBookApiData.completeLookIdList,
          completedCollectionList: lookBookApiData.completeCollectionIdList,
        }),
      );
    }
    catch (error) {
      console.error(error);
      showErrorScreen(() => initLookBook());
    }

    setState({
      ...state.current,
      onLoad: true,
    });
  };

  const onRefreshSyncMyLooks = () => {
    setState({
      ...state.current,
      refreshTrigger: Date.now(),
    });
  };

  const getRateSize = (size: number) => {
    const rate = size / 667;
    const value = Math.round((100 * rate) * 1000) / 1000;
    return value;
  };

  // const addButtonTriggerDiscover = (e: any) => {
  const addButtonTriggerDiscover = (currentScrollTop: number) => {
    // const currentScrollTop = refDiscoverContents.current.scrollTop;

    if (prevScrollTopDiscover.current < currentScrollTop) {
      setState({
        ...state.current,
        showAddButton: false,
      });
    }
    else {
      setState({
        ...state.current,
        showAddButton: true,
      });
    }

    // prevScrollTopDiscover.current = refDiscoverContents.current.scrollTop;
    prevScrollTopDiscover.current = currentScrollTop;

    if (currentScrollTop <= 0) {
      prevScrollTopDiscover.current = 0;
    }
  };

  // const addButtonTriggerMy = (e: any) => {
  const addButtonTriggerMy = (currentScrollTop: number) => {
    // const currentScrollTop = getBodyScrollView().scrollTop;

    if (prevScrollTopMy.current < currentScrollTop) {
      setState({
        ...state.current,
        showAddButton: false,
      });
    }
    else {
      setState({
        ...state.current,
        showAddButton: true,
      });
    }

    // prevScrollTopMy.current = getBodyScrollView().scrollTop;
    prevScrollTopMy.current = currentScrollTop;

    if (currentScrollTop <= 0) {
      prevScrollTopMy.current = 0;
    }
  };

  const callLookBookApi = async () => {
    const lookBookApi = new LookBookApi();
    try {
      await lookBookApi.request();
      return BPromise.resolve(lookBookApi.getData());
    }
    catch (error) {
      return BPromise.resolve(null);
    }
  };

  const onClickTab = (tabType: LOOKBOOK_TAB) => {
    SoundTouch();

    const { lookBookData } = props;

    if (tabType === LOOKBOOK_TAB.EXPLORE) {
      underbarRef.current.style.transform = `translateX(0)`;
    }
    else {
      underbarRef.current.style.transform = `translateX(50vw)`;
    }

    elementRefs.body.current.scroll(0, 0);

    if (state.current.tabType !== tabType) {
      setState({
        ...state.current,
        tabType,
        showAddButton: true,
      });

      try {
        if (tabType === LOOKBOOK_TAB.EXPLORE) {
          lookBookData.getDispatcher().sendFireBasePageEvent({
            eventId: 'lookbook_explore_page',
          });
        }
        else if (tabType === LOOKBOOK_TAB.MY) {
          lookBookData.getDispatcher().sendFireBasePageEvent({
            eventId: 'lookbook_my_page',
          });
        }
      }
      catch (error) {
        console.error(error);
      }
    }
  };

  const onClickGotoStudio = () => {
    SoundTouch();

    const { lookBookData } = props;

    lookBookData.getDispatcher().GotoStudio();
  };

  const renderAddContentButton = () => {
    const { tabType, showAddButton } = state.current;

    return (
      <Button.AddButton
        onClick={onClickGotoStudio}
        className={`${Style.btn_add} ${!showAddButton ? Style.hide : ''}`}
        style={{ marginBottom: `calc( ${ getRateSize(77) }vh + ${getRateSize(NOTCH_AREA.bottom)}vh )` }}
      />
    );
  };

  const tabRender = (selectType: LOOKBOOK_TAB, tabText: string) => {
    const { tabType } = state.current;

    return (
      <div
        className={`${Style.tab} ${tabType !== selectType && Style['tab--deactive']}`}
        onClick={(e: any) => {
          e.stopPropagation();
          onClickTab(selectType);
        }}
      >
        <span ref={tabType === selectType ? tabSpanRef : null} className={`${Style.tab_text} ${tabType !== selectType && Style['tab--deactive']}`} >
          {tabText}
        </span>
      </div>
    );
  };

  const exploreRender = () => {
    const { tabType } = state.current;
    const { lookBookData } = props;

    if (tabType === LOOKBOOK_TAB.EXPLORE && !discoverCompnent.current) {
      discoverCompnent.current =
        <LookBookDiscover
          lookBookData={lookBookData}
          scrollView={refDiscoverContents.current}
          callBackScroll={addButtonTriggerDiscover}
        />;
    }

    return (
      <div ref={refDiscover} className={`${Style['tab-contents']} ${tabType !== LOOKBOOK_TAB.EXPLORE && Style['tab-contents--hide']}`}>
        <div
          ref={refDiscoverContents}
          style={{ overflow: 'hidden' }}
          className={Style['tab-contents__wrap']}
        >
          {
            discoverCompnent &&
            <LookBookDiscover
              lookBookData={lookBookData}
              scrollView={refDiscover.current}
              refreshTrigger={state.current.refreshTrigger}
              callBackScroll={addButtonTriggerDiscover}
            />
          }
        </div>
      </div>
    );
  };

  const myRender = () => {
    const { tabType } = state.current;
    const { lookBookData } = props;

    if (tabType === LOOKBOOK_TAB.MY && !myContentsCompnent.current) {
      myContentsCompnent.current = <LookBookMy dataManager={lookBookData} callBackScroll={addButtonTriggerMy} />;
    }

    return (
      <div className={`${Style['tab-contents']} ${tabType !== LOOKBOOK_TAB.MY && Style['tab-contents--hide']}`} >
        {
          myContentsCompnent.current &&
          <LookBookMy
            dataManager={lookBookData}
            refreshTrigger={state.current.refreshTrigger}
            callBackScroll={addButtonTriggerMy}
          />
        }
      </div>
    );
  };

  const cbOnClickSearch = () => {
    SoundTouch();
    ADARouter.navigate(PAGE_ROUTES.LookSearchTag, {
      handleSelectTag,
    });
  };

  const handleSelectTag = (tagId: number, tagStr: string) => {

    const command: IApiLookBookDiscoverListCommand = {
      contentType: 'look',
      searchType: 'tag',
      searchId: tagId,
      sortType: 'update',
      page: 0,
      pagesize: 40,
    };
    const { lookBookData } = props;

    ADARouter.navigate(PAGE_ROUTES.DiscoverSearchList, {
      lookBookData,
      toMain: true,
      search: true,
      tagStr,
      command,
    });
  };

  return render({
    header: () =>
      <Header
        title={get('UI_COMMON_TEXT_FEEDTITLE')}
        skinType={3}
        backgroundColor={'white'}
        onClickNavigationBtn={props.onClickNavigation ? props.onClickNavigation : ADARouter.back}
        cbOnClickSearch={cbOnClickSearch}
      >
        <div className={Style.top} ref={tabRef}>
          <div ref={React.createRef()} className={Style.menu}>
            <div className={Style.underbar} ref={underbarRef} />
            {
              tabRender(LOOKBOOK_TAB.EXPLORE, get('UI_LOOKBOOK_MENU_EXPLOER'))
            }
            {
              tabRender(LOOKBOOK_TAB.MY, get('UI_LOOKBOOK_MENU_MY'))
            }
          </div>
        </div>
      </Header>,
    page: () =>
      state.current.onLoad &&
      <div className={Style.look_book} ref={lookBookRef}>
        {exploreRender()}
        {myRender()}

        {renderAddContentButton()}
      </div>,
  });
});