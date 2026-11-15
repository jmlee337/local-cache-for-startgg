import { Button, Stack, TextField } from '@mui/material';
import QRCode from 'react-qr-code';
import { ContentCopy } from '@mui/icons-material';
import { useMemo, useState } from 'react';
import { WebsocketStatus } from '../common/types';

export default function WebsocketAddresses({
  websocketStatus,
  path,
  hide,
}: {
  websocketStatus: WebsocketStatus;
  path: string;
  hide?: boolean;
}) {
  const [hostCopied, setHostCopied] = useState(false);
  const [v4Copied, setV4Copied] = useState(false);
  const [v6Copied, setV6Copied] = useState(false);
  const hostAddress = useMemo(
    () => (path ? `${websocketStatus.host}/${path}` : websocketStatus.host),
    [path, websocketStatus.host],
  );
  const v4Address = useMemo(
    () =>
      path ? `${websocketStatus.v4Address}/${path}` : websocketStatus.v4Address,
    [path, websocketStatus.v4Address],
  );
  const v6Address = useMemo(
    () =>
      path ? `${websocketStatus.v6Address}/${path}` : websocketStatus.v6Address,
    [path, websocketStatus.v6Address],
  );
  const [qrAddress, setQrAddress] = useState('');

  return (
    <>
      {websocketStatus.host && (
        <Stack alignItems="center" direction="row" gap="8px">
          <TextField
            label="Hostname"
            size="small"
            style={{ flexGrow: 1 }}
            value={hostAddress}
            variant="standard"
          />
          {!hide && (
            <Button
              onClick={() => {
                if (qrAddress === hostAddress) {
                  setQrAddress('');
                } else {
                  setQrAddress(hostAddress);
                }
              }}
              style={{ width: '74px' }}
              variant="contained"
            >
              {qrAddress === hostAddress ? 'Hide' : 'Show'}
            </Button>
          )}
          <Button
            disabled={hostCopied}
            endIcon={hostCopied ? undefined : <ContentCopy />}
            onClick={async () => {
              await window.electron.copy(hostAddress);
              setHostCopied(true);
              setTimeout(() => setHostCopied(false), 5000);
            }}
            variant="contained"
          >
            {hostCopied ? 'Copied!' : 'Copy'}
          </Button>
        </Stack>
      )}
      {websocketStatus.v6Address && (
        <Stack alignItems="center" direction="row" gap="8px">
          <TextField
            label="Websocket Address (IPv6)"
            size="small"
            style={{ flexGrow: 1 }}
            value={v6Address}
            variant="standard"
          />
          {!hide && (
            <Button
              onClick={() => {
                if (qrAddress === v6Address) {
                  setQrAddress('');
                } else {
                  setQrAddress(v6Address);
                }
              }}
              style={{ width: '74px' }}
              variant="contained"
            >
              {qrAddress === v6Address ? 'Hide' : 'Show'}
            </Button>
          )}
          <Button
            disabled={v6Copied}
            endIcon={v6Copied ? undefined : <ContentCopy />}
            onClick={async () => {
              await window.electron.copy(v6Address);
              setV6Copied(true);
              setTimeout(() => setV6Copied(false), 5000);
            }}
            variant="contained"
          >
            {v6Copied ? 'Copied!' : 'Copy'}
          </Button>
        </Stack>
      )}
      {websocketStatus.v4Address && (
        <Stack alignItems="center" direction="row" gap="8px">
          <TextField
            label="Websocket Address (IPv4)"
            size="small"
            style={{ flexGrow: 1 }}
            value={v4Address}
            variant="standard"
          />
          {!hide && (
            <Button
              onClick={() => {
                if (qrAddress === v4Address) {
                  setQrAddress('');
                } else {
                  setQrAddress(v4Address);
                }
              }}
              style={{ width: '74px' }}
              variant="contained"
            >
              {qrAddress === v4Address ? 'Hide' : 'Show'}
            </Button>
          )}
          <Button
            disabled={v4Copied}
            endIcon={v4Copied ? undefined : <ContentCopy />}
            onClick={async () => {
              await window.electron.copy(v4Address);
              setV4Copied(true);
              setTimeout(() => setV4Copied(false), 5000);
            }}
            variant="contained"
          >
            {v4Copied ? 'Copied!' : 'Copy'}
          </Button>
        </Stack>
      )}
      <Stack direction="row" justifyContent="center" marginTop="8px">
        {qrAddress && <QRCode value={qrAddress} size={250} />}
      </Stack>
    </>
  );
}

WebsocketAddresses.defaultProps = {
  hide: false,
};
