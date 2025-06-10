import React, { ReactNode } from 'react';
import { IconSrc, Icons } from 'folds';
import { MatrixEvent } from 'matrix-js-sdk';
import { IMemberContent, Membership } from '../../types/matrix/room';
import { getMxIdLocalPart } from '../utils/matrix';
import { isMembershipChanged } from '../utils/room';
import { partialMatrixIdToPhoneNumber } from '../../util/functionsUtil';

export type ParsedResult = {
  icon: IconSrc;
  body: ReactNode;
};

export type MemberEventParser = (mEvent: MatrixEvent) => ParsedResult;

export const useMemberEventParser = (): MemberEventParser => {
  const parseMemberEvent: MemberEventParser = (mEvent) => {
    const content = mEvent.getContent<IMemberContent>();
    const prevContent = mEvent.getPrevContent() as IMemberContent;
    const senderId = mEvent.getSender();
    const userId = mEvent.getStateKey();
    const reason = typeof content.reason === 'string' ? content.reason : undefined;

    if (!senderId || !userId)
      return {
        icon: Icons.User,
        body: 'Broken membership event',
      };

    const senderName = getMxIdLocalPart(senderId);
    const userName =
      typeof content.displayname === 'string'
        ? content.displayname || getMxIdLocalPart(userId)
        : getMxIdLocalPart(userId);

    if (isMembershipChanged(mEvent)) {
      if (content.membership === Membership.Invite) {
        if (prevContent.membership === Membership.Knock) {
          return {
            icon: Icons.ArrowGoRightPlus,
            body: (
              <>
                <b>{partialMatrixIdToPhoneNumber(senderName || '')}</b>
                {' accepted '}
                <b>{partialMatrixIdToPhoneNumber(userName || '')}</b>
                {`'s join request `}
                {reason}
              </>
            ),
          };
        }

        return {
          icon: Icons.ArrowGoRightPlus,
          body: (
            <>
              <b>{partialMatrixIdToPhoneNumber(senderName || '')}</b>
              {' invited '}
              <b>{partialMatrixIdToPhoneNumber(userName || '')}</b> {reason}
            </>
          ),
        };
      }

      if (content.membership === Membership.Knock) {
        return {
          icon: Icons.ArrowGoRightPlus,
          body: (
            <>
              <b>{partialMatrixIdToPhoneNumber(userName || '')}</b>
              {' request to join room '}
              {reason}
            </>
          ),
        };
      }

      if (content.membership === Membership.Join) {
        return {
          icon: Icons.ArrowGoRight,
          body: (
            <>
              <b>{partialMatrixIdToPhoneNumber(userName || '')}</b>
              {' joined the room'}
            </>
          ),
        };
      }

      if (content.membership === Membership.Leave) {
        if (prevContent.membership === Membership.Invite) {
          return {
            icon: Icons.ArrowGoRightCross,
            body:
              senderId === userId ? (
                <>
                  <b>{partialMatrixIdToPhoneNumber(userName || '')}</b>
                  {' rejected the invitation '}
                  {reason}
                </>
              ) : (
                <>
                  <b>{partialMatrixIdToPhoneNumber(senderName || '')}</b>
                  {' rejected '}
                  <b>{partialMatrixIdToPhoneNumber(userName || '')}</b>
                  {`'s join request `}
                  {reason}
                </>
              ),
          };
        }

        if (prevContent.membership === Membership.Knock) {
          return {
            icon: Icons.ArrowGoRightCross,
            body:
              senderId === userId ? (
                <>
                  <b>{partialMatrixIdToPhoneNumber(userName || '')}</b>
                  {' revoked joined request '}
                  {reason}
                </>
              ) : (
                <>
                  <b>{partialMatrixIdToPhoneNumber(senderName || '')}</b>
                  {' revoked '}
                  <b>{partialMatrixIdToPhoneNumber(userName || '')}</b>
                  {`'s invite `}
                  {reason}
                </>
              ),
          };
        }

        if (prevContent.membership === Membership.Ban) {
          return {
            icon: Icons.ArrowGoLeft,
            body: (
              <>
                <b>{partialMatrixIdToPhoneNumber(senderName || '')}</b>
                {' unbanned '}
                <b>{partialMatrixIdToPhoneNumber(userName || '')}</b> {reason}
              </>
            ),
          };
        }

        return {
          icon: Icons.ArrowGoLeft,
          body:
            senderId === userId ? (
              <>
                <b>{partialMatrixIdToPhoneNumber(userName || '')}</b>
                {' left the room '}
                {reason}
              </>
            ) : (
              <>
                <b>{partialMatrixIdToPhoneNumber(senderName || '')}</b>
                {' kicked '}
                <b>{partialMatrixIdToPhoneNumber(userName || '')}</b> {reason}
              </>
            ),
        };
      }

      if (content.membership === Membership.Ban) {
        return {
          icon: Icons.ArrowGoLeft,
          body: (
            <>
              <b>{partialMatrixIdToPhoneNumber(senderName || '')}</b>
              {' banned '}
              <b>{partialMatrixIdToPhoneNumber(userName || '')}</b> {reason}
            </>
          ),
        };
      }
    }

    if (content.displayname !== prevContent.displayname) {
      const prevUserName =
        typeof prevContent.displayname === 'string'
          ? prevContent.displayname || getMxIdLocalPart(userId)
          : getMxIdLocalPart(userId);

      return {
        icon: Icons.Mention,
        body:
          typeof content.displayname === 'string' ? (
            <>
              <b>{partialMatrixIdToPhoneNumber(prevUserName || '')}</b>
              {' changed display name to '}
              <b>{partialMatrixIdToPhoneNumber(userName || '')}</b>
            </>
          ) : (
            <>
              <b>{partialMatrixIdToPhoneNumber(prevUserName || '')}</b>
              {' removed their display name '}
            </>
          ),
      };
    }
    if (content.avatar_url !== prevContent.avatar_url) {
      return {
        icon: Icons.User,
        body:
          content.avatar_url && typeof content.avatar_url === 'string' ? (
            <>
              <b>{partialMatrixIdToPhoneNumber(userName || '')}</b>
              {' changed their avatar'}
            </>
          ) : (
            <>
              <b>{partialMatrixIdToPhoneNumber(userName || '')}</b>
              {' removed their avatar '}
            </>
          ),
      };
    }

    return {
      icon: Icons.User,
      body: 'Membership event with no changes',
    };
  };

  return parseMemberEvent;
};
