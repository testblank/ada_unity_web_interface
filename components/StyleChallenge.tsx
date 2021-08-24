import * as React from 'react';
import * as BPromise from 'bluebird';
import * as AEvent from 'src/app/event';
import { useEffect, useRef } from 'react';
import { useAdaState } from 'src/app/hooks/useAdaState';
import { useRootState } from 'src/app/hooks/useRootState';
import { useChallengeState } from 'src/app/hooks/useChallengeState';
import { usePVC } from 'src/app/pvc/v3';

import BaseRequestApi from 'src/app/api/baseRequestApi';
import StyleChallengeGetApi from 'src/app/api/styleChallenge/styleChallengeGet';
import { SkinType } from 'src/app/component/Header/v2';
import { UserDataManager } from 'app/data/user';
import { StyleChallengeDataManager } from 'src/app/data/content/styleChallenge';
import { ItemType } from '../MoneyShop';
import { SoundTouch } from 'src/util/sound';
import { parsingStyleChallengeDatas, IStyleChallengeData, getStyleChallengeDatas } from 'src/app/data/custom/styleChallenge';
import { WIDataResultStyleChallengeRegist, StyleChallengeFocusTab } from 'src/app/data/content/styleChallenge/dataType';
import { convertGenderToString } from 'src/util/convertGenderToString';
import { appPrimaryData } from 'src/app/webInterface/appPrimaryData';
import { getStaticValue } from 'src/static';
import { PAGE_ROUTES } from '../routeInfos';
import { ILook } from 'src/app/api/lookBook/lookBookMyApi';
import { Loading } from 'src/app/component';

import ErrorView from 'src/app/pvc/comp/error';
import InnerPullToRefresh, { AsyncTrigger } from 'src/app/pvc/misc/PullToRefresh/InnerPullToRefresh';
import StyleChallengeTab from './components/StyleChallengeTab';
import ChallengePage, { ChallengeStatus } from './components/ChallengePage';
import VotePage from './components/VotePage';
import Header from 'app/component/Header/v2/type/MoneyShopHeader';
import Style from './index.scss';
import PreventScrollChaining from 'src/app/pvc/misc/PreventScrollChaining';
import { getServerRealTime } from 'src/app/webInterface/misc/serverTimeStamp';

export enum SC_TAB {
  CHALLENGE = 'CHALLENGE',
  VOTE = 'VOTE',
}

interface IProps {
  userData?: UserDataManager;
  styleChallengeData?: StyleChallengeDataManager;
  currentTab?: SC_TAB;
  fromUnity?: boolean;
}

interface IState {
  currentTab?: SC_TAB;
  startChallenge?: IStyleChallengeData[];
  participatedChallenge?: IStyleChallengeData[];
  voteChallenge?: IStyleChallengeData[];
  endChallenge?: IStyleChallengeData[];
  ready?: boolean;
  errorScreen?: { [key: string]: () => void };
  isLoad?: boolean;
}

export default React.forwardRef((props: IProps, ref) => {
  const {
    render,
    constructor,
    ADARouter,
    elementRefs,
    setOption,
    getPageScreenRect,
    getBodyScrollView,
    visiblePageRender,
    showPageRender,
    visibleStaticUI,
  } = usePVC(props, ref);

  setOption({
    allowHeaderArea: true,
    allowFooterArea: false,
    showTopButton: true,
    showBottomNavi: false,
    pullToRefresh: false,
    whiteSkin: true,
    preventScrollChaining: false,
    showBottomPadding: false,
  });

  const { actions, dispatch, rootState } = useRootState();
  const { challengeState, challengeDispatch, challengeActions } = useChallengeState();

  const [state, setState] = useAdaState<IState>({
    currentTab: props.fromUnity ? props.currentTab : SC_TAB.CHALLENGE,
    startChallenge: [],
    participatedChallenge: [],
    voteChallenge: [],
    endChallenge: [],
    ready: false,
    errorScreen: {},
    isLoad: false,
  });

  const LOCAL_CHALLENGE_LIST_KEY = useRef<string>(`challengelist_${rootState.userData.accountId}`);
  const headerHeight = useRef<number>(0);
  const pageHeight = useRef<string>('');
  const isLoad = useRef(false);
  const _modalRef = useRef<HTMLDivElement>(null);
  const APIs = useRef<Array<BaseRequestApi<any>>>([]);

  useEffect(() => {
    initStyleChallenge();

    headerHeight.current = elementRefs.header.current.getHeight();
    pageHeight.current = `calc(100vh - ${headerHeight.current}px)`;
    getBodyScrollView().style.overflow = 'hidden';

    props.styleChallengeData.getDispatcher().onResultStyleChallengeRegist = onResultStyleChallengeRegist;

    const focusTab = props.styleChallengeData.getParamData().getFocusTab();

    setState({
      ...state.current,
      currentTab: focusTab === StyleChallengeFocusTab.VOTE ? SC_TAB.VOTE : SC_TAB.CHALLENGE,
    });

    return () => {
      APIs.current.forEach((api) => api.cancel());
    };
  }, []);

  useEffect(() => {
    refreshStyleChallenge();
    isLoad.current && localStorage.setItem(LOCAL_CHALLENGE_LIST_KEY.current, JSON.stringify(challengeState.participatedList));
  }, [challengeState.participatedList]);

  useEffect(() => {

  }, [isLoad]);

  const initStyleChallenge = async () => {
    try {
      await parsingStyleChallengeDatas();
      await callChallengeListApi();

      setState({
        ...state.current,
        isLoad: true,
      });
    }
    catch (error) {
      console.error(error);
      showErrorScreen(initStyleChallenge);
    }
  };

  const callChallengeListApi = async () => {
    const api = new StyleChallengeGetApi();

    try {
      await api.request();
      const res = api.getData();

      challengeDispatch(
        challengeActions.updateParticipatedList(res.challengeList),
      );
    }
    catch (error) {
      console.error(error);
    }
  };

  const onResultStyleChallengeRegist = (data: WIDataResultStyleChallengeRegist) => {
    const { challenge, lookCreate, success } = data;

    if (!success) {
      return;
    }

    if (challenge) {
      challengeDispatch(
        challengeActions.addParticipatedList({
          ...challenge,
        }),
      );

      if (lookCreate) {
        const lookData: ILook = {
          id: null,
          stylingImage: `${appPrimaryData.userImagesUrl}/${challenge.styleImage}`,
          parts: challenge.partsId,
          tag: [],
        } as ILook;

        ADARouter.navigate(PAGE_ROUTES.LookEditor, {
          lookEditorData: rootState.dataManager,
          lookData,
          method: 'CREATE',
          fromChallenge: true,
        });
      }
    }
  };

  const setParticipatedChallenge = () => {
    // const localChallengeList = localStorage.getItem(LOCAL_CHALLENGE_LIST_KEY.current);

    // if (localChallengeList) {
    //   challengeDispatch(
    //     challengeActions.updateParticipatedList(JSON.parse(localChallengeList)),
    //   );
    // }
    // else {
    //   callChallengeListApi();
    // }

    callChallengeListApi();

    isLoad.current = true;
  };

  const refreshStyleChallenge = () => {
    const styleChallengeDatas = getStyleChallengeDatas().filter((data) => data.genderType === convertGenderToString(rootState.userData.gender));
    const { startChallenge, participatedChallenge, voteChallenge, endChallenge } = filterStyleChallenge(styleChallengeDatas);

    setState({
      ...state.current,
      startChallenge,
      participatedChallenge,
      voteChallenge,
      endChallenge,
      ready: true,
    });
  };

  const filterStyleChallenge = (table: IStyleChallengeData[]) => {
    const startChallenge: IStyleChallengeData[] = [];
    const participatedChallenge: IStyleChallengeData[] = [];
    const voteChallenge: IStyleChallengeData[] = [];
    const endChallenge: IStyleChallengeData[] = [];
    const now = getServerRealTime();
    // const now = Date.now();

    console.log('getServerRealTime()', getServerRealTime());
    console.log('Date.now()', Date.now());
    console.log('getServerRealTime()', new Date(getServerRealTime()));
    console.log('Date.now()', new Date(Date.now()));

    const endDayLimit = getStaticValue('StyleChallenge_End_Keep_Day', 30);

    table.forEach((data) => {
      const startTime = data.parseChallengeStartTime;
      const voteStartTime = data.parseVoteStartTime;
      const endTime = data.parseVoteEndTime;

      if (!data.display) {
        return;
      }
      else if (now > startTime && now < voteStartTime) {  // start
        if (challengeState.participatedListMap[data.id]) {  // participate
          participatedChallenge.push(data);
          return;
        }

        startChallenge.push(data);
      }
      else if (now > voteStartTime && now < endTime) {  // vote
        voteChallenge.push(data);
      }
      else if (now > endTime && endTime + 86400000 * endDayLimit > now) {  // end
        endChallenge.push(data);
      }
    });

    startChallenge.sort((a, b) => a.parseVoteStartTime - b.parseVoteStartTime);
    participatedChallenge.sort((a, b) => a.parseVoteStartTime - b.parseVoteStartTime);
    voteChallenge.sort((a, b) => a.parseVoteEndTime - b.parseVoteEndTime);
    endChallenge.sort((a, b) => b.parseVoteEndTime - a.parseVoteEndTime);

    return {
      startChallenge,
      participatedChallenge,
      voteChallenge,
      endChallenge,
    };
  };

  const cbOnClickTab = (currentTab: SC_TAB) => {
    if (currentTab !== state.current.currentTab) {
      SoundTouch();
      setState({ ...state.current, currentTab });
    }
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

    return ErrorView(screenRect.bodyHeight, { onRetry: onRetryStyleChallenge });
  };

  const onRetryStyleChallenge = () => {
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

  const onRefreshTrigger = async (async: AsyncTrigger) => {
    Loading.disable();

    localStorage.removeItem(LOCAL_CHALLENGE_LIST_KEY.current);
    await callChallengeListApi();
    async.next();

    Loading.enable();
  };

  const onClickAboutChallenge = () => {
    SoundTouch();

    ADARouter.navigate(PAGE_ROUTES.AboutChallenge, {});
  };

  const renderAboutChallengeButton = () => {
    return (
      <div className={Style.btn_about_challenge} onClick={onClickAboutChallenge}>
        ?
      </div>
    );
  };

  return render({
    pageModal: () =>
      state.current.errorScreen[state.current.currentTab] &&
      renderErrorScreen(),
    modal: () =>
      <div ref={_modalRef} />,
    header: () =>
      <Header
        skinType={SkinType.NewWhite}
        userData={props.userData}
        currentTab={ItemType.TICKET}
        renderRightArea={renderAboutChallengeButton}
      >
        <StyleChallengeTab
          ready={state.current.ready}
          currentTab={state.current.currentTab}
          cbOnClickTab={cbOnClickTab}
        />
      </Header>,
    page: () =>
      state.current.ready &&
      <>
        <div
          style={{
            position: 'relative',
            display: state.current.currentTab === SC_TAB.CHALLENGE ? 'block' : 'none',
            height: pageHeight.current,
            overflowY: 'scroll',
            overflowX: 'hidden',
            marginTop: '5px',
          }}
        >
          <InnerPullToRefresh disable={state.current.currentTab === SC_TAB.VOTE} onRefreshTrigger={onRefreshTrigger} />

          <ChallengePage
            currentTab={state.current.currentTab}
            startChallenge={state.current.startChallenge}
            participatedChallenge={state.current.participatedChallenge}
            voteChallenge={state.current.voteChallenge}
            endChallenge={state.current.endChallenge}
            refreshStyleChallenge={refreshStyleChallenge}
          />
        </div>

        <div
          style={{
            position: 'relative',
            display: state.current.currentTab === SC_TAB.VOTE ? 'block' : 'none',
            height: pageHeight.current,
            overflowY: 'scroll',
            overflowX: 'hidden',
            marginTop: '5px',
          }}
        >
          <VotePage
            modalRef={_modalRef.current}
            currentTab={state.current.currentTab}
            voteChallenge={state.current.voteChallenge}
            showErrorScreen={showErrorScreen}
          />
        </div>
      </>,
  });
});
