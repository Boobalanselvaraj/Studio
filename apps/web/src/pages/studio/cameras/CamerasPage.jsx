import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/ui/table';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Plus, Camera, RefreshCw } from 'lucide-react';

export function CamerasPage() {
  const cameras = [
    { id: '1', name: 'Sony A7IV #1', model: 'ILCE-7M4', username: 'studio_cam_a7iv_1', status: 'Active', lastSync: '10 mins ago' },
    { id: '2', name: 'Canon R5 #1', model: 'EOS R5', username: 'studio_cam_r5_1', status: 'Active', lastSync: '2 hours ago' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Cameras & SFTP Sync</h2>
          <p className="text-sm text-muted">Provision camera SFTP credentials for automatic in-camera shoot uploads via SFTPGo.</p>
        </div>

        <Button className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Camera Device
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configured Camera Devices</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Camera Name</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>SFTP Username</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Sync</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cameras.map((cam) => (
                <TableRow key={cam.id}>
                  <TableCell className="font-semibold flex items-center gap-2">
                    <Camera className="w-4 h-4 text-brand-primary" /> {cam.name}
                  </TableCell>
                  <TableCell className="text-muted">{cam.model}</TableCell>
                  <TableCell><code className="text-xs bg-surface-2 px-1.5 py-0.5 rounded">{cam.username}</code></TableCell>
                  <TableCell><Badge variant="success">{cam.status}</Badge></TableCell>
                  <TableCell className="text-xs text-muted">{cam.lastSync}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline">Edit</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
