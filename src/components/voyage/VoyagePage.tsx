import React from 'react';
import STTApi from '../../api';
import { VoyageCrewSelect } from './VoyageCrewSelect';
import { VoyageLog } from './VoyageLog';
import { ICommandBarItemProps } from 'office-ui-fabric-react/lib/CommandBar';

export interface VoyagePageProps {
   onCommandItemsUpdate?: (items: ICommandBarItemProps[]) => void;
}

export const VoyagePage = (props: VoyagePageProps) => {
   const [, updateState] = React.useState();
   const forceUpdate = React.useCallback(() => {
      updateState({});
      updateCommandItems(); // when a voyage starts, command items need to update to show toggle
   }, []);
   const [showCalcAnyway, setShowCalcAnyway] = React.useState<boolean>(STTApi.mockData);
   const [autoRecall, setAutoRecall] = React.useState<boolean>(STTApi.voyAutoRecall);
   const [autoDilemma, setAutoDilemma] = React.useState<boolean>(STTApi.voyAutoDilemma);
   const [autoReplenish, setAutoReplenish] = React.useState<boolean>(STTApi.voyAutoReplenish);

   React.useEffect(() => updateCommandItems(), [showCalcAnyway, autoRecall, autoReplenish]);

   function updateCommandItems() {
      if (props.onCommandItemsUpdate) {
         const activeVoyage = STTApi.playerData.character.voyage.length > 0;

         if (activeVoyage) {
            props.onCommandItemsUpdate([
               {
                  key: 'switchVoyDisplay',
                  name: showCalcAnyway ? 'Switch to log' : 'Switch to recommendations',
                  iconProps: { iconName: 'Switch' },
                  onClick: () => {
                     setShowCalcAnyway(!showCalcAnyway);
                  }
               },
               {
                  key: 'settings',
                  text: 'Settings',
                  iconProps: { iconName: 'Equalizer' },
                  subMenuProps: {
                     items: [{
                        key: 'auto',
                        text: 'Auto',
                        subMenuProps: {
                           items: [{
                                 key: 'auto_recall',
                                 text: 'Auto Recall',
                                 canCheck: true,
                                 isChecked: autoRecall,
                                 onClick: () => {
                                    STTApi.voyAutoRecall = !autoRecall
                                    setAutoRecall(!autoRecall);
                                 }
                              }, {
                                 key: 'auto_dilemma',
                                 text: 'Auto Dilemma',
                                 canCheck: true,
                                 isChecked: autoDilemma,
                                 onClick: () => {
                                    STTApi.voyAutoDilemma = !autoDilemma
                                    setAutoDilemma(!autoDilemma);
                                 }
                           },
                           {
                                 key: 'auto_replenish',
                                 text: 'Auto Replenish',
                                 canCheck: true,
                                 isChecked: autoReplenish,
                                 onClick: () => {
                                    STTApi.voyAutoReplenish = !autoReplenish
                                    setAutoReplenish(!autoReplenish);
                                 }
                              }]
                        }
                     }]
                  }
               }
            ]);
         } else {
            props.onCommandItemsUpdate([]);
         }
      }
   }

   const activeVoyage = STTApi.playerData.character.voyage.length > 0;

   return (
      <div className='tab-panel' data-is-scrollable='true'>
         {(!activeVoyage || showCalcAnyway) && <VoyageCrewSelect onRefreshNeeded={() => forceUpdate()} />}
         {activeVoyage && !showCalcAnyway && <VoyageLog />}
      </div>
   );
}